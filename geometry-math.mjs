export class Vec3 {
  static add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static scale(v, s) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  static lerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  }

  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static len(v) {
    return Math.hypot(v.x, v.y, v.z);
  }

  static dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static normalize(v) {
    const l = Vec3.len(v);
    if (l < 1e-9) return { x: 0, y: 0, z: 1 };
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }

  static scalarTripleProductNormalized(a, b, c, d) {
    const ab = Vec3.sub(b, a);
    const ac = Vec3.sub(c, a);
    const ad = Vec3.sub(d, a);
    const denom = Vec3.len(ab) * Vec3.len(ac) * Vec3.len(ad);
    if (denom < 1e-8) return 0;
    const crossVec = Vec3.cross(ab, ac);
    return Math.abs(Vec3.dot(crossVec, ad)) / denom;
  }

  static computePolygon3DMetrics(orderedPts3D) {
    if (!orderedPts3D || orderedPts3D.length < 3) {
      return { area3D: 0, perimeter3D: 0 };
    }
    let perimeter3D = 0;
    for (let i = 0; i < orderedPts3D.length; i++) {
      const p1 = orderedPts3D[i];
      const p2 = orderedPts3D[(i + 1) % orderedPts3D.length];
      perimeter3D += Vec3.dist(p1, p2);
    }

    let area3D = 0;
    const p0 = orderedPts3D[0];
    for (let i = 1; i < orderedPts3D.length - 1; i++) {
      const u = Vec3.sub(orderedPts3D[i], p0);
      const v = Vec3.sub(orderedPts3D[i + 1], p0);
      area3D += 0.5 * Vec3.len(Vec3.cross(u, v));
    }
    return { area3D, perimeter3D };
  }
}

export class Quat4 {
  static identity() {
    return { w: 1, x: 0, y: 0, z: 0 };
  }

  static fromAxisAngle(axis, angleRad) {
    const half = angleRad * 0.5;
    const s = Math.sin(half);
    const n = Vec3.normalize(axis);
    return Quat4.normalize({
      w: Math.cos(half),
      x: n.x * s,
      y: n.y * s,
      z: n.z * s
    });
  }

  static fromEulerXY(rotX, rotY) {
    const qx = Quat4.fromAxisAngle({ x: 1, y: 0, z: 0 }, rotX);
    const qy = Quat4.fromAxisAngle({ x: 0, y: 1, z: 0 }, rotY);
    return Quat4.multiply(qx, qy);
  }

  static normalize(q) {
    const len = Math.hypot(q.w, q.x, q.y, q.z);
    if (len < 1e-9) return Quat4.identity();
    return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
  }

  static multiply(a, b) {
    return Quat4.normalize({
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    });
  }

  static slerp(q1, q2, t) {
    let cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;
    let b = { ...q2 };
    if (cosHalfTheta < 0) {
      b = { w: -q2.w, x: -q2.x, y: -q2.y, z: -q2.z };
      cosHalfTheta = -cosHalfTheta;
    }
    if (cosHalfTheta >= 0.9995) {
      return Quat4.normalize({
        w: q1.w + t * (b.w - q1.w),
        x: q1.x + t * (b.x - q1.x),
        y: q1.y + t * (b.y - q1.y),
        z: q1.z + t * (b.z - q1.z)
      });
    }
    const halfTheta = Math.acos(Math.min(1, Math.max(-1, cosHalfTheta)));
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    return Quat4.normalize({
      w: q1.w * ratioA + b.w * ratioB,
      x: q1.x * ratioA + b.x * ratioB,
      y: q1.y * ratioA + b.y * ratioB,
      z: q1.z * ratioA + b.z * ratioB
    });
  }

  static rotateVec3(q, v) {
    const vx = v.x, vy = v.y, vz = v.z;
    const qw = q.w, qx = q.x, qy = q.y, qz = q.z;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return {
      x: vx + qw * tx + (qy * tz - qz * ty),
      y: vy + qw * ty + (qz * tx - qx * tz),
      z: vz + qw * tz + (qx * ty - qy * tx)
    };
  }
}

/**
 * ============================================================================
 * MODULE 2: ĐỒ THỊ HÌNH HỌC KHÔNG GIAN 3D, KHO 11 HÌNH CƠ BẢN & TRÌNH TẠO HÌNH
 * ============================================================================
 */
export class ConstructionGraph {
  static solve(vertices, definitions, hidden = [], showPresets = true) {
    const result = {}, visiting = new Set(), byId = new Map(definitions.map(p => [p.id, p]));
    const hiddenIds = new Set(hidden);
    const solve = id => {
      if (result[id]) return result[id];
      if (visiting.has(id)) throw new Error('Quan hệ điểm bị vòng lặp');
      const vertex = vertices[id], def = byId.get(id);
      if (vertex) return result[id] = { ...vertex, id, role: 'vertex', kind: 'FREE', parentEdge: [id], ratio: null,
        hidden: hiddenIds.has(id), desc: vertex.desc || 'Đỉnh ' + id };
      if (!def) throw new Error('Không tìm thấy điểm ' + id);
      visiting.add(id);
      const a = solve(def.p1), b = solve(def.p2), position = Vec3.lerp(a, b, def.ratio);
      visiting.delete(id);
      const midpoint = Math.abs(def.ratio - 0.5) < 1e-7;
      return result[id] = { ...position, id, role: midpoint ? 'midpoint' : 'edgepoint', kind: 'ON_SEGMENT',
        parentEdge: [def.p1, def.p2], ratio: def.ratio,
        hidden: hiddenIds.has(id) || (def.preset && !showPresets),
        desc: (midpoint ? 'Trung điểm ' : 'Điểm chia cạnh ') + id + ' (' + def.p1 + def.p2 + ')' };
    };
    for (const id of Object.keys(vertices)) solve(id);
    for (const def of definitions) solve(def.id);
    return result;
  }
}
