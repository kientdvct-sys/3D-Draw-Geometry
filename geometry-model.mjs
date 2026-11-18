import { Vec3 } from './geometry-math.mjs';
import { sectionConvexPolyhedron } from './geometry-sections.mjs';

const EPS = 1e-9;
const kinds = ['points', 'linears', 'planes', 'solids', 'sections', 'constraints', 'relations'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (...values) => values.every(Number.isFinite);
const vector = p => record(p) && finite(p.x, p.y, p.z);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const magnitude = v => Math.hypot(v.x, v.y, v.z);
const position = (a, d, t) => Vec3.add(a, Vec3.scale(d, t));
const idPattern = /^[A-Za-z0-9_:'-]{1,128}$/;
export const legacyLabel = /^[A-Z][A-Z0-9']*(?:_[A-Z0-9]+)?$/;
export const validPointLabel = label => typeof label === 'string' && label.length <= 16 && legacyLabel.test(label);
export const normalizePointLabel = value => String(value ?? '').normalize('NFKC').trim().replace(/[’‘′]/gu, "'").toUpperCase();

export function parameterInDomain(kind, t) {
  return Number.isFinite(t) && (kind === 'line' || (t >= 0 && (kind === 'ray' || (kind === 'segment' && t <= 1))));
}

export function parameterDomain(kind) {
  return kind === 'segment' ? [0, 1] : kind === 'ray' ? [0, Infinity] : [-Infinity, Infinity];
}

const numericalEpsilon = 32 * Number.EPSILON;
const angularLimit = 1e-7;
const normalDirection = direction => {
  const length = direction && magnitude(direction);
  return length > 0 && Number.isFinite(length)
    ? { length, unit: { x: direction.x / length, y: direction.y / length, z: direction.z / length } } : null;
};
const maxComponent = p => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
const worldTolerance = (a, b, localScale) => 1e-9 * localScale + numericalEpsilon * Math.max(maxComponent(a), maxComponent(b));
const status = status => ({ status });
function boundedParameter(kind, t) {
  const [lo, hi] = parameterDomain(kind);
  const tolerance = 1e-9;
  return t >= lo - tolerance && t <= hi + tolerance ? Math.max(lo, Math.min(hi, t)) : null;
}

export function intersectLinears(a, b) {
  const av = normalDirection(a?.direction), bv = normalDirection(b?.direction);
  if (!av || !bv || !vector(a.origin) || !vector(b.origin)) return status('degenerate');
  const delta = Vec3.sub(b.origin, a.origin);
  const cross = Vec3.cross(av.unit, bv.unit), sine = magnitude(cross);
  if (!vector(delta) || !Number.isFinite(sine)) return status('ill-conditioned');
  const localScale = Math.max(av.length, bv.length);
  const tolerance = worldTolerance(a.origin, b.origin, localScale);
  if (sine <= numericalEpsilon) {
    if (magnitude(Vec3.cross(delta, av.unit)) > tolerance) return status('parallel');
    const offset = Vec3.dot(delta, av.unit), orientation = Math.sign(Vec3.dot(av.unit, bv.unit));
    const interval = (kind, start, length, sign) => kind === 'line' ? [-Infinity, Infinity]
      : kind === 'ray' ? (sign > 0 ? [start, Infinity] : [-Infinity, start])
        : [Math.min(start,start+length*sign), Math.max(start,start+length*sign)];
    const [a0,a1] = interval(a.kind,0,av.length,1), [b0,b1] = interval(b.kind,offset,bv.length,orientation);
    const lo = Math.max(a0,b0), hi = Math.min(a1,b1);
    if (finite(lo,hi) && Math.abs(hi-lo) <= tolerance) {
      const x = lo/2 + hi/2;
      const t = boundedParameter(a.kind,x/av.length), u = boundedParameter(b.kind,(x-offset)/bv.length*orientation);
      if (t !== null && u !== null) return { status:'intersect',t,u,point:position(a.origin,a.direction,t),residual:0 };
    }
    return { status:'coincident', overlap: hi >= lo };
  }
  if (sine < angularLimit) return status('ill-conditioned');
  const axis = Vec3.scale(cross, 1 / sine);
  const residual = Math.abs(Vec3.dot(delta, axis));
  if (residual > tolerance) return { status: 'skew', residual };
  const t = Vec3.dot(Vec3.cross(delta, bv.unit), axis) / sine / av.length;
  const u = Vec3.dot(Vec3.cross(delta, av.unit), axis) / sine / bv.length;
  const p = position(a.origin, a.direction, t), q = position(b.origin, b.direction, u);
  if (!finite(t, u) || !vector(p) || !vector(q) ||
      magnitude(Vec3.sub(p, q)) > tolerance + numericalEpsilon * Math.max(maxComponent(p), maxComponent(q))) {
    return status('ill-conditioned');
  }
  const tBound = boundedParameter(a.kind, t), uBound = boundedParameter(b.kind, u);
  return tBound === null || uBound === null
    ? { status: 'outside-domain', t, u, point: p, residual }
    : { status: 'intersect', t: tBound, u: uBound, point: position(a.origin, a.direction, tBound), residual };
}

export function intersectLinearPlane(line, plane) {
  const d = normalDirection(line?.direction), n = normalDirection(plane?.normal);
  if (!d || !n || !vector(line.origin) || !vector(plane.origin)) return status('degenerate');
  const delta = Vec3.sub(plane.origin, line.origin);
  const normalOffset = Vec3.dot(n.unit, delta), denominator = Vec3.dot(n.unit, d.unit);
  if (!finite(normalOffset, denominator)) return status('ill-conditioned');
  if (Math.abs(denominator) <= numericalEpsilon) {
    const tolerance = worldTolerance(line.origin, plane.origin, d.length);
    return status(Math.abs(normalOffset) <= tolerance ? 'contained' : 'parallel');
  }
  if (Math.abs(denominator) < angularLimit) return status('ill-conditioned');
  const t = normalOffset / denominator / d.length, point = position(line.origin, line.direction, t);
  if (!finite(t) || !vector(point)) return status('ill-conditioned');
  const bounded = boundedParameter(line.kind, t);
  return bounded === null ? { status: 'outside-domain', t, point }
    : { status: 'intersect', t: bounded, point: position(line.origin, line.direction, bounded) };
}

// Screens supply homogeneous coordinates x, y, w. Only this display interval is clipped.
export function clipLinear(line, transform, bounds, near = 0, far = Infinity) {
  const a = transform(line.origin, false), d = transform(line.direction, true);
  if (!finite(a.x, a.y, a.w, d.x, d.y, d.w)) return null;
  let [lo, hi] = parameterDomain(line.kind);
  for (const [offset, rate] of [
    [a.x - bounds.left * a.w, d.x - bounds.left * d.w],
    [bounds.right * a.w - a.x, bounds.right * d.w - d.x],
    [a.y - bounds.top * a.w, d.y - bounds.top * d.w],
    [bounds.bottom * a.w - a.y, bounds.bottom * d.w - d.y],
    [a.w - near, d.w], ...(Number.isFinite(far) ? [[far - a.w, -d.w]] : [])
  ]) {
    if (!finite(offset, rate)) return null;
    if (rate > 0) lo = Math.max(lo, -offset / rate);
    else if (rate < 0) hi = Math.min(hi, -offset / rate);
    else if (offset < 0) return null;
    if (lo >= hi) return null;
  }
  if (!finite(lo, hi)) return null;
  const endpoints = [lo, hi].map(t => position(line.origin, line.direction, t));
  return endpoints.every(vector) ? { lo, hi, endpoints } : null;
}

function dependencies(group, item, indexes) {
  const ref = (key, id) => {
    requireValue(indexes[key].has(id), `${item.id}: invalid ${key} reference ${id}`);
    return id;
  };
  const refs = (key, ids, min = 0) => {
    requireValue(Array.isArray(ids) && ids.length >= min, `${item.id}: invalid ${key} references`);
    return ids.map(id => ref(key, id));
  };
  const distinct = (ids, count) => {
    requireValue(new Set(ids).size === count && ids.length === count, `${item.id}: distinct references required`);
    return ids;
  };
  if (group === 'points') {
    const d = item.definition;
    requireValue(record(d), `${item.id}: missing point definition`);
    switch (d.kind) {
      case 'free':
        requireValue(vector(d.position), `${item.id}: invalid position`);
        return [];
      case 'midpoint': return distinct(refs('points', d.points, 2), 2);
      case 'onLinear': {
        const id = ref('linears', d.linear);
        requireValue(parameterInDomain(indexes.linears.get(id).kind, d.t), `${item.id}: t out of domain`);
        return [id];
      }
      case 'onPlane':
        requireValue(finite(d.u, d.v), `${item.id}: invalid plane coordinates`);
        return [ref('planes', d.plane)];
      case 'intersectionLL': return distinct(refs('linears', d.linears, 2), 2);
      case 'intersectionLP': return [ref('linears', d.linear), ref('planes', d.plane)];
      default: throw new Error(`${item.id}: unknown point definition`);
    }
  }
  if (group === 'linears') {
    requireValue(['segment', 'ray', 'line'].includes(item.kind), `${item.id}: invalid linear kind`);
    requireValue(item.style === undefined || ['AUTO', 'SOLID', 'DASHED'].includes(item.style), `${item.id}: invalid line style`);
    return distinct(refs('points', item.points, 2), 2);
  }
  if (group === 'planes') return distinct(refs('points', item.points, 3), 3);
  if (group === 'solids') {
    const vertices = refs('points', item.vertices, 4);
    requireValue(new Set(vertices).size === vertices.length && Array.isArray(item.faces) && item.faces.length >= 4, `${item.id}: invalid solid`);
    const faces = new Map();
    for (const face of item.faces) {
      requireValue(record(face) && idPattern.test(face.id ?? '') && !faces.has(face.id), `${item.id}: invalid face ID`);
      const nodes = refs('points', face.points, 3);
      requireValue(new Set(nodes).size === nodes.length && nodes.every(id => vertices.includes(id)), `${item.id}: invalid face topology`);
      faces.set(face.id, new Set(nodes));
    }
    requireValue(Array.isArray(item.edges), `${item.id}: missing edges`);
    for (const edge of item.edges) {
      requireValue(record(edge), `${item.id}: invalid edge`);
      const endpoints = distinct(refs('points', edge.points, 2), 2);
      requireValue(endpoints.every(id => vertices.includes(id)) && Array.isArray(edge.faces) &&
        edge.faces.every(id => faces.has(id) && endpoints.every(p => faces.get(id).has(p))), `${item.id}: invalid edge topology`);
    }
    return vertices;
  }
  if (group === 'sections') return [ref('solids', item.solid), ref('planes', item.plane)];
  const subjects = item.subjects;
  const exists = id => kinds.some(key => indexes[key].has(id));
  requireValue(typeof item.kind === 'string' && item.kind.length > 0 && Array.isArray(subjects) && subjects.length > 0, `${item.id}: invalid relation or constraint`);
  requireValue(subjects.every(exists), `${item.id}: invalid subject`);
  if (group === 'constraints') return subjects;
  const provenance = item.provenance;
  requireValue(record(provenance) && ['given', 'construction', 'rule', 'numeric'].includes(provenance.kind), `${item.id}: invalid provenance`);
  if (provenance.kind === 'rule') requireValue(typeof provenance.rule === 'string' && provenance.rule.length > 0 &&
    Array.isArray(provenance.premises) && provenance.premises.length > 0, `${item.id}: missing rule premises`);
  const premises = provenance.premises ?? [];
  requireValue(Array.isArray(premises) && premises.every(exists), `${item.id}: invalid premise`);
  return [...subjects, ...premises];
}

function orderGraph(snapshot) {
  requireValue(record(snapshot) && snapshot.version === '8.0', 'Unsupported geometry snapshot');
  const indexes = {}, entries = new Map(), labels = new Set();
  for (const group of kinds) {
    requireValue(Array.isArray(snapshot[group]) && snapshot[group].length <= 2048, `Invalid ${group}`);
    indexes[group] = new Map();
    for (const item of snapshot[group]) {
      requireValue(record(item) && typeof item.id === 'string' && idPattern.test(item.id) && !entries.has(item.id), `Invalid or duplicate ${group} ID`);
      if (group === 'points') {
        requireValue(validPointLabel(item.label) && !labels.has(item.label), 'Invalid or duplicate point label');
        requireValue(['hidden', 'locked'].every(key => item[key] === undefined || typeof item[key] === 'boolean'), 'Invalid point flags');
        labels.add(item.label);
      }
      indexes[group].set(item.id, item);
      entries.set(item.id, { group, item });
    }
  }
  const order = [], visiting = new Set(), complete = new Set();
  function visit(id) {
    if (complete.has(id)) return;
    requireValue(!visiting.has(id), `Dependency cycle at ${id}`);
    visiting.add(id);
    const entry = entries.get(id);
    entry.parents = dependencies(entry.group, entry.item, indexes);
    for (const parent of entry.parents) visit(parent);
    order.push(entry);
    visiting.delete(id);
    complete.add(id);
  }
  for (const id of entries.keys()) visit(id);
  return order;
}

export function validateModel(snapshot) {
  orderGraph(snapshot);
  return snapshot;
}

function evaluatePoint(item, get) {
  const d = item.definition;
  switch (d.kind) {
    case 'free': return d.position;
    case 'midpoint': return Vec3.lerp(...d.points.map(get), .5);
    case 'onLinear': {
      const { origin, direction } = get(d.linear);
      return position(origin, direction, d.t);
    }
    case 'onPlane': {
      const { origin, u, v } = get(d.plane);
      return position(position(origin, u, d.u), v, d.v);
    }
    case 'intersectionLP': {
      const result = intersectLinearPlane(get(d.linear), get(d.plane));
      return result.status === 'intersect' ? result.point : result.status;
    }
    case 'intersectionLL': {
      const result = intersectLinears(...d.linears.map(get));
      return result.status === 'intersect' ? result.point : result.status;
    }
  }
}

export function resolveModel(snapshot) {
  const results = new Map();
  const get = id => results.get(id)?.value;
  for (const { group, item, parents } of orderGraph(snapshot)) {
    const undefinedParent = parents.find(id => results.get(id).status === 'undefined');
    let value;
    if (undefinedParent) value = 'undefined-parent';
    else if (group === 'points') {
      value = evaluatePoint(item, get);
      if (typeof value !== 'string' && !vector(value)) value = 'non-finite-position';
    } else if (group === 'linears') {
      const [origin, endpoint] = item.points.map(get), direction = Vec3.sub(endpoint, origin);
      value = vector(direction) && normalDirection(direction) ? { origin, direction, kind: item.kind } : 'degenerate-linear';
    } else if (group === 'planes') {
      const [origin, b, c] = item.points.map(get), u = Vec3.sub(b, origin), v = Vec3.sub(c, origin);
      const cross = Vec3.cross(u, v), length = magnitude(cross), scale = magnitude(u) * magnitude(v);
      value = Number.isFinite(length) && length > EPS * scale ? { origin, u, v, normal: Vec3.scale(cross, 1 / length) } : 'degenerate-plane';
    } else if(group==='sections') {
      value=sectionConvexPolyhedron(get(item.solid),get(item.plane),get);
    } else value = item;
    results.set(item.id, typeof value === 'string'
      ? { status: 'undefined', reason: value, ...(undefinedParent && { parent: undefinedParent }) }
      : { status: 'defined', value });
  }
  return results;
}

export class GeometryDocument {
  #snapshot;
  #resolved;
  #selection = [];
  #revisions = { geometry: 0, view: 0, selection: 0, style: 0 };

  constructor(snapshot) { this.#snapshot = validateModel(structuredClone(snapshot)); }
  get revisions() { return { ...this.#revisions }; }
  get selection() { return [...this.#selection]; }
  export() { return structuredClone(this.#snapshot); }
  resolve() { return structuredClone(this.#resolved ??= resolveModel(this.#snapshot)); }

  import(snapshot) {
    const next = validateModel(structuredClone(snapshot));
    this.#snapshot = next;
    this.#resolved = undefined;
    this.#selection = [];
    for (const key of Object.keys(this.#revisions)) this.#revisions[key]++;
  }

  updateGeometry(edit) {
    const next = this.export();
    edit(next);
    this.#snapshot = structuredClone(validateModel(next));
    this.#resolved = undefined;
    this.#revisions.geometry++;
    const ids = new Set(kinds.flatMap(group => next[group].map(item => item.id)));
    this.setSelection(this.#selection.filter(id => ids.has(id)));
  }

  setSelection(ids) {
    const known = new Set(kinds.flatMap(group => this.#snapshot[group].map(item => item.id)));
    requireValue(Array.isArray(ids) && ids.every(id => known.has(id)), 'Invalid selection');
    if (ids.length === this.#selection.length && ids.every((id, index) => id === this.#selection[index])) return;
    this.#selection = [...ids];
    this.#revisions.selection++;
  }

  setCameraQuaternion(cameraQuaternion) {
    requireValue(Array.isArray(cameraQuaternion) && cameraQuaternion.length === 4 &&
      cameraQuaternion.every(Number.isFinite) && Math.hypot(...cameraQuaternion) > EPS, 'Invalid camera quaternion');
    if (cameraQuaternion.every((value, i) => value === this.#snapshot.cameraQuaternion?.[i])) return;
    this.#snapshot.cameraQuaternion = [...cameraQuaternion];
    this.#revisions.view++;
  }

  setLinearStyle(id, style) {
    requireValue(['AUTO', 'SOLID', 'DASHED'].includes(style), 'Invalid line style');
    const line = this.#snapshot.linears.find(item => item.id === id);
    requireValue(line, 'Linear object not found');
    if ((line.style ?? 'AUTO') === style) return;
    line.style = style;
    this.#revisions.style++;
  }

  renamePoint(id, label) {
    label = normalizePointLabel(label);
    const next = this.export(), point = next.points.find(p => p.id === id);
    requireValue(point, 'Point not found');
    if (point.label === label) return;
    if (point.presentation?.label === point.label) point.presentation.label = label;
    point.label = label;
    this.#snapshot = validateModel(next);
    this.#resolved = undefined;
    this.#revisions.style++;
  }
}
