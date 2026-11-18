import { validPointLabel, validateModel } from './geometry-model.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const presetKeyOK = key => typeof key === 'string' && /^[A-Z0-9_]{1,100}$/.test(key);

function validatePresentation(data) {
  check(presetKeyOK(data.presetKey), 'Invalid preset key');
  check(typeof data.problemStatement === 'string' && data.problemStatement.length <= 20000, 'Invalid problem statement');
  const q = data.cameraQuaternion;
  check(q === undefined || (Array.isArray(q) && q.length === 4 && q.every(Number.isFinite)), 'Invalid camera quaternion');
  if (data.cameraState !== undefined) {
    const c = data.cameraState;
    check(record(c) && Number.isFinite(c.zoom) && Number.isFinite(c.yawAngle) &&
      Number.isFinite(c.floorTiltDeg) && typeof c.isFloorLocked === 'boolean', 'Invalid camera state');
  }
  if (data.notebookView !== undefined) {
    const n = data.notebookView;
    check(record(n) && ['follow3D', 'visible'].every(key => n[key] === undefined || typeof n[key] === 'boolean'), 'Invalid notebook view');
  }
}

function withLegacyDefaults(data, preset) {
  for (const key of ['presetDefinition', 'baseVertices', 'derivedMidpoints', 'customPoints', 'userSegments',
    'faces', 'baseEdges', 'hiddenPointIds', 'lockedPointIds', 'focusedNodes', 'pointIds', 'showPresetMidpoints', 'spatialConstruction']) {
    check(data[key] !== null, `Invalid ${key}`);
  }
  if (preset !== undefined) {
    check(record(preset) && record(preset.baseVertices) && Array.isArray(preset.faces) &&
      Array.isArray(preset.baseEdges), 'Invalid preset definition');
  }
  return {
    ...data, version: '7.0',
    problemStatement: data.problemStatement ?? preset?.defaultProblem ?? '',
    baseVertices: data.baseVertices ?? preset?.baseVertices,
    derivedMidpoints: data.derivedMidpoints ?? preset?.derivedMidpoints ?? [],
    customPoints: data.customPoints ?? [],
    userSegments: data.userSegments ?? [],
    faces: data.faces ?? preset?.faces,
    baseEdges: data.baseEdges ?? preset?.baseEdges,
    hiddenPointIds: data.hiddenPointIds ?? [],
    lockedPointIds: data.lockedPointIds ?? [],
    focusedNodes: data.focusedNodes ?? [],
    showPresetMidpoints: data.showPresetMidpoints ?? true
  };
}

export function migrateLegacy(data, preset = data?.presetDefinition) {
  check(record(data) && (data.version === '7.0' || data.version === undefined), 'Unsupported legacy snapshot');
  const old = withLegacyDefaults(data, preset);
  validatePresentation(old);
  check(record(old.baseVertices) && Object.keys(old.baseVertices).length > 0 &&
    Object.keys(old.baseVertices).length <= 128, 'Invalid vertices');
  for (const key of ['derivedMidpoints', 'customPoints', 'userSegments', 'faces', 'baseEdges', 'focusedNodes', 'hiddenPointIds', 'lockedPointIds']) {
    check(Array.isArray(old[key]) && old[key].length <= 512, `Invalid ${key}`);
  }
  check(old.derivedMidpoints.length + old.customPoints.length <= 256, 'Too many dependent points');
  check(typeof old.showPresetMidpoints === 'boolean', 'Invalid preset point visibility');
  const ids = old.pointIds ?? {};
  check(record(ids), 'Invalid point IDs');
  check(old.pointSequence === undefined || (Number.isSafeInteger(old.pointSequence) &&
    old.pointSequence >= 0 && old.pointSequence < Number.MAX_SAFE_INTEGER), 'Invalid point sequence');
  const used = new Map(), occupied = new Set();
  const spatial = { sections: [], constraints: [], relations: [], ...(old.spatialConstruction ?? { points: [], linears: [], planes: [] }) };
  check(record(spatial) && ['points', 'linears', 'planes'].every(key => Array.isArray(spatial[key]) &&
    spatial[key].length <= 2048) && ['sections','constraints','relations'].every(key=>Array.isArray(spatial[key])&&spatial[key].length<=2048), 'Invalid spatial construction');
  for (const group of ['points', 'linears', 'planes','sections','constraints','relations']) for (const item of spatial[group]) {
    check(record(item) && typeof item.id === 'string' && !occupied.has(item.id), 'Invalid spatial ID');
    if (group === 'points') {
      check(validPointLabel(item.label) && !used.has(item.label), 'Invalid spatial point name');
      used.set(item.label, item.id);
    }
    occupied.add(item.id);
  }
  if(old.solidId!==undefined){
    check(typeof old.solidId==='string'&&!occupied.has(old.solidId),'Invalid solid ID');
    occupied.add(old.solidId);
  }
  function add(label) {
    check(validPointLabel(label) && !used.has(label), 'Invalid or duplicate point label');
    const id = Object.hasOwn(ids, label) ? ids[label] : 'p:' + label;
    check(typeof id === 'string' && !occupied.has(id), 'Invalid or duplicate legacy point ID');
    used.set(label, id);
    occupied.add(id);
    return id;
  }
  function objectId(preferred) {
    let id = preferred, suffix = 0;
    while (occupied.has(id)) id = preferred + ':' + (++suffix);
    occupied.add(id);
    return id;
  }
  function ref(label) {
    check(typeof label === 'string' && used.has(label), 'Invalid point reference');
    return used.get(label);
  }
  const flags = label => ({ hidden: old.hiddenPointIds.includes(label), locked: old.lockedPointIds.includes(label) });
  const points = Object.entries(old.baseVertices).map(([label, vertex]) => {
    check(record(vertex) && [vertex.x, vertex.y, vertex.z].every(Number.isFinite), 'Invalid vertex position');
    const { x, y, z, ...presentation } = vertex;
    return { id: add(label), label, definition: { kind: 'free', position: { x, y, z } }, ...flags(label), presentation };
  });
  for (const d of [...old.derivedMidpoints, ...old.customPoints]) {
    check(record(d), 'Invalid dependent point');
    add(d.id);
  }
  const linears = [];
  for (const [collection, presetPoint] of [[old.derivedMidpoints, true], [old.customPoints, false]]) {
    for (const { id: label, p1, p2, ratio, ...presentation } of collection) {
      check(Number.isFinite(ratio) && ratio > 0 && ratio < 1, 'Invalid point chia đoạn');
      const id = ref(label), endpoints = [ref(p1), ref(p2)];
      let definition = { kind: 'midpoint', points: endpoints };
      if (ratio !== .5) {
        const linear = objectId('support:' + id.slice(0, 110));
        linears.push({ id: linear, kind: 'segment', points: endpoints, constructionOnly: true });
        definition = { kind: 'onLinear', linear, t: ratio };
      }
      points.push({ id, label, definition, ...flags(label), presetPoint, presentation });
    }
  }
  for (const key of ['hiddenPointIds', 'lockedPointIds', 'focusedNodes']) old[key].forEach(ref);
  const styles = new Set(['AUTO', 'SOLID', 'DASHED', undefined]);
  old.userSegments.forEach((edge, index) => {
    check(record(edge) && styles.has(edge.style), 'Invalid user edge style');
    const { u, v, style, ...presentation } = edge;
    linears.push({ id: objectId('user:' + index), kind: 'segment', points: [ref(u), ref(v)],
      ...(style !== undefined && { style }), presentation });
  });
  const faces = old.faces.map(face => {
    check(record(face) && Array.isArray(face.nodes), 'Invalid face');
    const { id, nodes, ...presentation } = face;
    return { id, points: nodes.map(ref), presentation };
  });
  const edges = [];
  old.baseEdges.forEach((edge, index) => {
    check(record(edge) && Array.isArray(edge.faces) && styles.has(edge.forceStyle), 'Invalid base edge');
    const { u, v, faces: faceIds, ...presentation } = edge;
    const points = [ref(u), ref(v)];
    check(faceIds.every(id => faces.some(f => f.id === id)), 'Invalid edge face reference');
    if (edge.isInternal) {
      linears.push({ id: objectId('guide:' + index), kind: 'segment', points, baseGuide: true, legacyOrder: index,
        presentation: { ...presentation, faces: [...faceIds] } });
    } else edges.push({ points, faces: [...faceIds], presentation, legacyOrder: index });
  });
  const vertices = [...new Set([...faces.flatMap(f => f.points), ...edges.flatMap(e => e.points)])];
  const free = new Set(points.filter(p => p.definition.kind === 'free').map(p => p.id));
  check(vertices.every(id => free.has(id)), 'Structural vertices must be free points');
  const solids = [{ id: old.solidId??objectId('solid:0'), vertices, faces, edges }];
  const { version, baseVertices, derivedMidpoints, customPoints, userSegments, faces: oldFaces, baseEdges,
    hiddenPointIds, lockedPointIds, focusedNodes, pointIds, spatialConstruction, solidId, ...presentation } = old;
  return validateModel({
    ...copy(presentation), version: '8.0',
    points: [...points, ...spatial.points.map(point => ({ ...point, spatial: true,
      hidden: point.hidden || flags(point.label).hidden, locked: point.locked || flags(point.label).locked }))],
    linears: [...linears, ...spatial.linears.map(line => ({ ...line, spatial: true }))], planes: spatial.planes,
    solids, sections: spatial.sections, constraints: spatial.constraints,
    relations: spatial.relations, focus: focusedNodes.map(ref)
  });
}

export function normalizeSnapshot(input, preset) {
  check(record(input), 'Invalid snapshot');
  const data = copy(input);
  if (data.version === '8.0') {
    validatePresentation(data);
    validateModel(data);
    const ids = new Set(data.points.map(p => p.id));
    check(data.focus === undefined || (Array.isArray(data.focus) && data.focus.every(id => ids.has(id))), 'Invalid focus');
    return data;
  }
  migrateLegacy(data, preset);
  return withLegacyDefaults(data, preset);
}

// Keep 7.0 fields for the existing tools and retain native, ID-based constructions alongside them.
export function legacyProjection(data) {
  const model = normalizeSnapshot(data);
  check(model.version === '8.0' && model.solids.length === 1, 'Model requires exactly one solid');
  const labels = new Map(model.points.map(p => [p.id, p.label]));
  const linears = new Map(model.linears.map(l => [l.id, l]));
  const label = id => labels.get(id);
  const baseVertices = {}, derivedMidpoints = [], customPoints = [], usedSupports = new Set();
  const spatialConstruction = { points: [], linears: [], planes: model.planes, sections: model.sections,
    constraints:model.constraints, relations:model.relations };
  const legacyIds = new Set(model.points.filter(p => p.definition.kind === 'free' && !p.spatial).map(p => p.id));
  const supportCount = new Map();
  for (const { definition: d } of model.points) {
    for (const id of d.linears ?? (d.linear ? [d.linear] : [])) supportCount.set(id, (supportCount.get(id) ?? 0) + 1);
  }
  for(const item of [...model.constraints,...model.relations]){
    for(const id of [...item.subjects,...(item.provenance?.premises??[])]) if(linears.has(id)) supportCount.set(id,2);
  }
  const endpoints = d => d.kind === 'midpoint' ? d.points
    : d.kind === 'onLinear' && linears.get(d.linear)?.constructionOnly && supportCount.get(d.linear) === 1 &&
      linears.get(d.linear).kind === 'segment' && d.t > 0 && d.t < 1 ? linears.get(d.linear).points : null;
  let grew;
  do {
    grew = false;
    for (const p of model.points) if (!p.spatial && !legacyIds.has(p.id) && endpoints(p.definition)?.every(id => legacyIds.has(id))) {
      legacyIds.add(p.id); grew = true;
    }
  } while (grew);
  for (const p of model.points) {
    const d = p.definition;
    if (!legacyIds.has(p.id)) { spatialConstruction.points.push(p); continue; }
    if (d.kind === 'free') {
      baseVertices[p.label] = { ...p.presentation, ...d.position };
      continue;
    }
    let points = d.points, ratio = .5;
    if (d.kind === 'onLinear') {
      const line = linears.get(d.linear);
      usedSupports.add(line.id);
      points = line.points;
      ratio = d.t;
    } else check(d.kind === 'midpoint', 'Model requires newer construction tools');
    const [p1, p2] = points.map(label);
    (p.presetPoint ? derivedMidpoints : customPoints).push({ ...p.presentation, id: p.label, p1, p2, ratio });
  }
  const [solid] = model.solids;
  const faces = solid.faces.map(f => ({ ...f.presentation, id: f.id, nodes: f.points.map(label) }));
  const indexedEdges = solid.edges.map(e => [e.legacyOrder, {
    ...e.presentation, u: label(e.points[0]), v: label(e.points[1]), faces: e.faces
  }]);
  const userSegments = model.linears.flatMap(l => {
    if (usedSupports.has(l.id)) return [];
    if (l.baseGuide) {
      indexedEdges.push([l.legacyOrder, { ...l.presentation, u: label(l.points[0]), v: label(l.points[1]) }]);
      return [];
    }
    if (l.spatial || l.constructionOnly || l.kind !== 'segment' || supportCount.has(l.id) ||
        l.points.some(id => !legacyIds.has(id))) {
      spatialConstruction.linears.push(l);
      return [];
    }
    return [{ ...l.presentation, u: label(l.points[0]), v: label(l.points[1]), ...(l.style !== undefined && { style: l.style }) }];
  });
  const baseEdges = indexedEdges.sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity)).map(([, edge]) => edge);
  const { points, linears: lines, planes, solids, sections, constraints, relations, focus, ...presentation } = model;
  const legacy = {
    ...presentation, version: '7.0', baseVertices, derivedMidpoints, customPoints, faces, baseEdges, userSegments,
    pointIds: Object.fromEntries(model.points.filter(p => legacyIds.has(p.id)).map(p => [p.label, p.id])),
    ...(solid.id!=='solid:0'&&{solidId:solid.id}),
    ...(Object.values(spatialConstruction).some(items=>items.length) && { spatialConstruction }),
    hiddenPointIds: model.points.filter(p => p.hidden).map(p => p.label),
    lockedPointIds: model.points.filter(p => p.locked).map(p => p.label), focusedNodes: (focus ?? []).map(label)
  };
  return normalizeSnapshot(legacy);
}
