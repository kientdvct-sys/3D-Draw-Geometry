import { normalizeSnapshot } from './geometry-snapshot.mjs';
import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const studioInstance = createHash('sha256').update(root).digest('hex');
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
export function validateLesson(data) {
  if (typeof data?.title !== 'string' || !data.title.trim() || data.title.length > 255) {
    throw new Error('Tên giáo án phải có 1–255 ký tự.');
  }
  return normalizeSnapshot(data);
}

async function createStore(options) {
  if (options.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: options.databaseUrl });
    await pool.query(await readFile(resolve(root, 'schema.sql'), 'utf8'));
    return {
      kind: 'postgresql',
      async list() { return (await pool.query('SELECT snapshot FROM spatial_lessons ORDER BY created_at DESC')).rows.map(r => r.snapshot); },
      async add(record) { await pool.query('INSERT INTO spatial_lessons (id, title, snapshot) VALUES ($1, $2, $3)', [record.id, record.title, JSON.stringify(record)]); },
      async delete(id) { await pool.query('DELETE FROM spatial_lessons WHERE id = $1', [id]); },
      async close() { await pool.end(); }
    };
  }
  const file = options.dataFile || resolve(root, 'data', 'lessons.json');
  await mkdir(dirname(file), { recursive: true });
  let lessons;
  try { lessons = JSON.parse(await readFile(file, 'utf8')); if (!Array.isArray(lessons)) throw new Error('Invalid lesson store'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; lessons = []; }
  let queue = Promise.resolve();
  const mutate = operation => {
    const next = queue.then(async () => {
      const updated = operation(lessons);
      const temporary = file + '.tmp';
      await writeFile(temporary, JSON.stringify(updated, null, 2), 'utf8');
      await rename(temporary, file);
      lessons = updated;
    });
    queue = next.catch(() => {});
    return next;
  };
  return {
    kind: 'json-file',
    async list() { await queue; return structuredClone(lessons); },
    async add(record) { await mutate(items => { if (items.some(i => i.id === record.id)) throw Object.assign(new Error('ID đã tồn tại.'), { status: 409 }); return [record, ...items]; }); },
    async delete(id) { await mutate(items => items.filter(i => i.id !== id)); },
    async close() { await queue; }
  };
}

export async function createApp(options = {}) {
  const store = await createStore(options);
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const origin = req.headers.origin;
      // This server is local by default. Permit the local HTML file and local previews.
      if (origin && origin !== 'null') {
        let local = false;
        try { local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch {}
        if (!local) return json(403, { error: 'Origin không được phép.' });
      }
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') return json(204);
      if (url.pathname === '/api/health' && req.method === 'GET') {
        res.setHeader('X-Geometry-Studio', studioInstance);
        return json(200, { status: 'ok', storage: store.kind });
      }
      if (url.pathname === '/api/v1/lessons') {
        if (req.method === 'GET') return json(200, { lessons: await store.list(), storage: store.kind });
        if (req.method !== 'POST') return json(405, { error: 'Phương thức không được hỗ trợ.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Yêu cầu Content-Type: application/json.' });
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024 * 1024) return json(413, { error: 'Giáo án vượt quá 1 MB.' });
          chunks.push(chunk);
        }
        let lesson;
        try { lesson = validateLesson(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (error) { return json(400, { error: error.message }); }
        lesson.id = idPattern.test(lesson.id || '') ? lesson.id : 'lesson-' + randomUUID();
        lesson.createdAt = new Date().toISOString();
        await store.add(lesson);
        return json(201, lesson);
      }
      if (url.pathname.startsWith('/api/v1/lessons/')) {
        const id = decodeURIComponent(url.pathname.slice('/api/v1/lessons/'.length));
        if (!idPattern.test(id)) return json(400, { error: 'ID không hợp lệ.' });
        if (req.method === 'DELETE') { await store.delete(id); return json(204); }
        return json(405, { error: 'Phương thức không được hỗ trợ.' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Phương thức không được hỗ trợ.' });
      // Allowlist avoids serving backups, credentials, database files, or source code.
      const staticFiles = {
        '/': ['TEST2.html', 'text/html; charset=utf-8'],
        '/TEST2.html': ['TEST2.html', 'text/html; charset=utf-8'],
        '/geometry-math.mjs': ['geometry-math.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-model.mjs': ['geometry-model.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-snapshot.mjs': ['geometry-snapshot.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-scene.mjs': ['geometry-scene.mjs', 'text/javascript; charset=utf-8'],
        '/tracking-runtime.mjs': ['tracking-runtime.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-sections.mjs': ['geometry-sections.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-properties.mjs': ['geometry-properties.mjs', 'text/javascript; charset=utf-8'],
        '/geometry-properties-panel.mjs': ['geometry-properties-panel.mjs', 'text/javascript; charset=utf-8'],
        '/studio-ui.mjs': ['studio-ui.mjs', 'text/javascript; charset=utf-8'],
        '/studio-ui.css': ['studio-ui.css', 'text/css; charset=utf-8']
      };
      const file = Object.hasOwn(staticFiles, url.pathname) ? staticFiles[url.pathname] : null;
      if (!file) return json(404, { error: 'Không tìm thấy.' });
      const content = await readFile(resolve(root, file[0]));
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': content.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      console.error('Request failed:', error.message);
      json(error.status || (error.code === '23505' ? 409 : 500), { error: error.status === 409 || error.code === '23505' ? 'ID giáo án đã tồn tại.' : 'Không thể hoàn tất yêu cầu lưu trữ.' });
    }
  });
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server, store } = await createApp({ databaseUrl: process.env.DATABASE_URL, dataFile: process.env.LESSON_DATA_FILE });
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  const address = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  const url = `http://${address}:${port}`;
  server.once('error', async error => {
    await store.close();
    if (error.code !== 'EADDRINUSE') {
      console.error('Không khởi động được Geometry Studio.', error.message);
      process.exitCode = 1;
      return;
    }
    let sameStudio = false;
    if (['127.0.0.1', 'localhost', '::1'].includes(host)) {
      try {
        const health = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1500) });
        const instance = health.headers.get('x-geometry-studio');
        sameStudio = health.ok && instance === studioInstance;
        // An older running copy serves the same files but has no instance header.
        if (health.ok && !instance && (await health.json()).status === 'ok') {
          const entry = await fetch(url + '/TEST2.html', { signal: AbortSignal.timeout(1500) });
          sameStudio = entry.ok && Buffer.from(await entry.arrayBuffer()).equals(await readFile(resolve(root, 'TEST2.html')));
        }
      } catch { /* An occupied port is not necessarily an HTTP server. */ }
    }
    if (sameStudio) console.log(`Geometry Studio đang chạy tại ${url}/TEST2.html`);
    else {
      console.error(`Cổng ${port} đang được ứng dụng khác sử dụng. Hãy đổi cổng PORT hoặc đóng ứng dụng đó rồi chạy lại.`);
      process.exitCode = 1;
    }
  });
  server.listen(port, host, () => console.log(`Local: http://${address}:${server.address().port}/TEST2.html (${store.kind})`));
  const stop = () => server.close(async () => { await store.close(); process.exit(0); });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
