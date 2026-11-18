import { normalizeSnapshot } from './geometry-snapshot.mjs';
import './geometry-math.mjs';
import './geometry-model.mjs';
import './geometry-sections.mjs';
import './geometry-properties.mjs';
import './geometry-scene.mjs';
import './tracking-runtime.mjs';
import './geometry-properties-panel.mjs';
import './studio-ui.mjs';
import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const studioInstance = createHash('sha256').update(root).digest('hex');
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;

const FALLBACK_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS spatial_lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

async function readHtmlEntry() {
  try {
    return await readFile(resolve(root, 'index.html'));
  } catch (error) {
    if (error.code === 'ENOENT') return await readFile(resolve(root, 'TEST2.html'));
    throw error;
  }
}

async function readStaticAsset(pathname) {
  switch (pathname) {
    case '/':
    case '/index.html':
    case '/TEST2.html':
      return [await readHtmlEntry(), 'text/html; charset=utf-8'];
    case '/geometry-math.mjs':
      return [await readFile(resolve(root, 'geometry-math.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-model.mjs':
      return [await readFile(resolve(root, 'geometry-model.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-snapshot.mjs':
      return [await readFile(resolve(root, 'geometry-snapshot.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-scene.mjs':
      return [await readFile(resolve(root, 'geometry-scene.mjs')), 'text/javascript; charset=utf-8'];
    case '/tracking-runtime.mjs':
      return [await readFile(resolve(root, 'tracking-runtime.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-sections.mjs':
      return [await readFile(resolve(root, 'geometry-sections.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-properties.mjs':
      return [await readFile(resolve(root, 'geometry-properties.mjs')), 'text/javascript; charset=utf-8'];
    case '/geometry-properties-panel.mjs':
      return [await readFile(resolve(root, 'geometry-properties-panel.mjs')), 'text/javascript; charset=utf-8'];
    case '/studio-ui.mjs':
      return [await readFile(resolve(root, 'studio-ui.mjs')), 'text/javascript; charset=utf-8'];
    case '/studio-ui.css':
      return [await readFile(resolve(root, 'studio-ui.css')), 'text/css; charset=utf-8'];
    default:
      return null;
  }
}

export function validateLesson(data) {
  if (typeof data?.title !== 'string' || !data.title.trim() || data.title.length > 255) {
    throw new Error('Tên giáo án phải có 1–255 ký tự.');
  }
  return normalizeSnapshot(data);
}

async function createStore(options = {}) {
  if (options.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: options.databaseUrl });
    let schemaSql;
    try {
      schemaSql = await readFile(resolve(root, 'schema.sql'), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        await pool.end().catch(() => {});
        throw error;
      }
      schemaSql = FALLBACK_SCHEMA_SQL;
    }
    await pool.query(schemaSql);
    return {
      kind: 'postgresql',
      async list() {
        return (await pool.query('SELECT snapshot FROM spatial_lessons ORDER BY created_at DESC')).rows.map(r => r.snapshot);
      },
      async add(record) {
        await pool.query('INSERT INTO spatial_lessons (id, title, snapshot) VALUES ($1, $2, $3)', [record.id, record.title, JSON.stringify(record)]);
      },
      async delete(id) {
        await pool.query('DELETE FROM spatial_lessons WHERE id = $1', [id]);
      },
      async close() {
        await pool.end();
      }
    };
  }

  const defaultFile = process.env.VERCEL
    ? resolve(tmpdir(), 'lessons.json')
    : resolve(root, 'data', 'lessons.json');
  let file = options.dataFile || process.env.LESSON_DATA_FILE || defaultFile;

  try {
    await mkdir(dirname(file), { recursive: true });
  } catch (error) {
    if (!options.dataFile && (error.code === 'EROFS' || error.code === 'EACCES' || error.code === 'EPERM')) {
      file = resolve(tmpdir(), 'lessons.json');
      await mkdir(dirname(file), { recursive: true });
    } else {
      throw error;
    }
  }

  let lessons;
  try {
    lessons = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(lessons)) throw new Error('Invalid lesson store');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    lessons = [];
  }

  let queue = Promise.resolve();
  const mutate = operation => {
    const next = queue.then(async () => {
      const updated = operation(lessons);
      const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporary, JSON.stringify(updated, null, 2), 'utf8');
      await rename(temporary, file);
      lessons = updated;
    });
    queue = next.catch(() => {});
    return next;
  };

  return {
    kind: 'json-file',
    async list() {
      await queue;
      return structuredClone(lessons);
    },
    async add(record) {
      await mutate(items => {
        if (items.some(i => i.id === record.id)) {
          throw Object.assign(new Error('ID đã tồn tại.'), { status: 409 });
        }
        return [record, ...items];
      });
    },
    async delete(id) {
      await mutate(items => items.filter(i => i.id !== id));
    },
    async close() {
      await queue;
    }
  };
}

function isAllowedOrigin(origin, req) {
  if (!origin || origin === 'null') return true;
  try {
    const parsed = new URL(origin);
    const originHost = parsed.host.toLowerCase();
    const originHostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '[::1]'].includes(originHostname)) return true;
    const requestHosts = [req.headers['x-forwarded-host'], req.headers.host]
      .flatMap(value => (value || '').split(','))
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    return requestHosts.includes(originHost) || requestHosts.includes(originHostname);
  } catch {
    return false;
  }
}

export async function createApp(options = {}) {
  const store = await createStore(options);

  const handleRequest = async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };

    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const origin = req.headers.origin;

      if (!isAllowedOrigin(origin, req)) {
        return json(403, { error: 'Origin không được phép.' });
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
        if (req.method === 'GET') {
          return json(200, { lessons: await store.list(), storage: store.kind });
        }
        if (req.method !== 'POST') {
          return json(405, { error: 'Phương thức không được hỗ trợ.' });
        }
        if (!req.headers['content-type']?.startsWith('application/json')) {
          return json(415, { error: 'Yêu cầu Content-Type: application/json.' });
        }

        let rawBody = '';
        if (!req.readableEnded) {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > 1024 * 1024) return json(413, { error: 'Giáo án vượt quá 1 MB.' });
            chunks.push(buffer);
          }
          rawBody = Buffer.concat(chunks).toString('utf8');
        } else {
          try {
            if (typeof req.body === 'string') rawBody = req.body;
            else if (Buffer.isBuffer(req.body)) rawBody = req.body.toString('utf8');
            else if (req.body && typeof req.body === 'object') rawBody = JSON.stringify(req.body);
          } catch (error) {
            return json(400, { error: error.message });
          }
          if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
            return json(413, { error: 'Giáo án vượt quá 1 MB.' });
          }
        }

        let lesson;
        try {
          lesson = validateLesson(JSON.parse(rawBody));
        } catch (error) {
          return json(400, { error: error.message });
        }

        lesson.id = idPattern.test(lesson.id || '') ? lesson.id : 'lesson-' + randomUUID();
        lesson.createdAt = new Date().toISOString();
        await store.add(lesson);
        return json(201, lesson);
      }

      if (url.pathname.startsWith('/api/v1/lessons/')) {
        let id;
        try {
          id = decodeURIComponent(url.pathname.slice('/api/v1/lessons/'.length));
        } catch {
          return json(400, { error: 'ID không hợp lệ.' });
        }
        if (!idPattern.test(id)) return json(400, { error: 'ID không hợp lệ.' });
        if (req.method === 'DELETE') {
          await store.delete(id);
          return json(204);
        }
        return json(405, { error: 'Phương thức không được hỗ trợ.' });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return json(405, { error: 'Phương thức không được hỗ trợ.' });
      }

      const asset = await readStaticAsset(url.pathname);
      if (!asset) return json(404, { error: 'Không tìm thấy.' });

      const [content, contentType] = asset;
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      console.error('Request failed:', error.message);
      const status = error.status || (error.code === '23505' ? 409 : 500);
      const message = status === 409 ? 'ID giáo án đã tồn tại.' : 'Không thể hoàn tất yêu cầu lưu trữ.';
      json(status, { error: message });
    }
  };

  const server = http.createServer(handleRequest);
  return { server, store, handleRequest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server, store } = await createApp({
    databaseUrl: process.env.DATABASE_URL,
    dataFile: process.env.LESSON_DATA_FILE
  });
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
        if (health.ok && !instance && (await health.json()).status === 'ok') {
          const entry = await fetch(url + '/TEST2.html', { signal: AbortSignal.timeout(1500) });
          sameStudio = entry.ok && Buffer.from(await entry.arrayBuffer()).equals(await readHtmlEntry());
        }
      } catch {}
    }
    if (sameStudio) {
      console.log(`Geometry Studio đang chạy tại ${url}/TEST2.html`);
    } else {
      console.error(`Cổng ${port} đang được ứng dụng khác sử dụng. Hãy đổi cổng PORT hoặc đóng ứng dụng đó rồi chạy lại.`);
      process.exitCode = 1;
    }
  });

  server.listen(port, host, () => {
    console.log(`Local: http://${address}:${server.address().port}/TEST2.html (${store.kind})`);
  });

  const stop = () => server.close(async () => {
    await store.close();
    process.exit(0);
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

let vercelAppPromise = null;
export default async function handler(req, res) {
  if (!vercelAppPromise) {
    vercelAppPromise = createApp({
      databaseUrl: process.env.DATABASE_URL,
      dataFile: process.env.LESSON_DATA_FILE
    }).catch(error => {
      vercelAppPromise = null;
      throw error;
    });
  }
  const { handleRequest } = await vercelAppPromise;
  await handleRequest(req, res);
}
