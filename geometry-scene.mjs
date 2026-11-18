import { ConstructionGraph, Vec3 } from './geometry-math.mjs';
import { legacyProjection, migrateLegacy, normalizeSnapshot } from './geometry-snapshot.mjs';
import { intersectLinearPlane, intersectLinears, normalizePointLabel, parameterInDomain, resolveModel, validPointLabel } from './geometry-model.mjs';
import { intersectFiniteFaces, intersectPlanes, planeThrough } from './geometry-sections.mjs';
import { analyzeGeometry } from './geometry-properties.mjs';

const emptySpatial = () => ({ points: [], linears: [], planes: [], sections: [], constraints: [], relations: [] });
const sameEnds = (a, b) => a.u === b.u && a.v === b.v || a.u === b.v && a.v === b.u;
export class GeometrySceneGraph {
  constructor() {
    this.geometryRevision = 0;
    this.styleRevision = 0;
    this.showPresetMidpoints = true;
    this.customPoints = [];
    this.currentPresetKey = "S_ABCD";
    this.problemStatement = "";
    this.historyStack = [];
    this.redoStack = [];
    this.presets = GeometrySceneGraph.createPresetLibrary();
    this.loadPreset("S_ABCD");
  }

  static buildParametricPreset({
    title,
    family = "PYRAMID",
    sides = 5,
    height = 2.8,
    radius = 1.75,
    apexStyle = "CENTER"
  }) {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const midLetters = ["M", "N", "P", "Q", "K", "E", "F", "H"];
    const n = Math.max(3, Math.min(8, parseInt(sides, 10) || 4));
    height = Math.max(1, Math.min(4, Number(height) || 2.8));
    radius = Math.max(1, Math.min(3, Number(radius) || 1.75));
    const hHalf = height * 0.5;

    const baseVertices = {};
    const derivedMidpoints = [];
    const faces = [];
    const baseEdges = [];
    const bottomIds = [];

    for (let i = 0; i < n; i++) {
      const angle = -Math.PI * 0.65 + (i * 2 * Math.PI) / n;
      const id = letters[i];
      bottomIds.push(id);
      baseVertices[id] = {
        x: Number((radius * Math.cos(angle)).toFixed(3)),
        y: Number((-hHalf * 0.78).toFixed(3)),
        z: Number((radius * Math.sin(angle)).toFixed(3)),
        label: id,
        role: "vertex",
        desc: `Đỉnh đáy ${id}`
      };
    }

    if (family === "PYRAMID" || family === "BIPYRAMID") {
      let sx = 0, sz = 0;
      if (apexStyle === "PERP_A") {
        sx = baseVertices.A.x;
        sz = baseVertices.A.z;
      } else if (apexStyle === "OBLIQUE") {
        sx = -0.55;
        sz = -0.35;
      }

      baseVertices.S = {
        x: sx,
        y: Number((hHalf * 1.15).toFixed(3)),
        z: sz,
        label: "S",
        role: "vertex",
        desc: "Đỉnh chóp S"
      };

      if (family === "BIPYRAMID") {
        baseVertices["S'"] = {
          x: sx,
          y: Number((-hHalf * 1.85).toFixed(3)),
          z: sz,
          label: "S'",
          role: "vertex",
          desc: "Đỉnh dưới S'"
        };
      } else {
        faces.push({ id: bottomIds.join(""), nodes: [...bottomIds].reverse() });
      }

      for (let i = 0; i < n; i++) {
        const u = bottomIds[i];
        const v = bottomIds[(i + 1) % n];
        const nextPrev = bottomIds[(i - 1 + n) % n];
        const fCurr = `S${u}${v}`;
        const fPrev = `S${nextPrev}${u}`;
        faces.push({ id: fCurr, nodes: ["S", u, v] });

        if (family === "BIPYRAMID") {
          const fBotCurr = `S'${v}${u}`;
          const fBotPrev = `S'${u}${nextPrev}`;
          faces.push({ id: fBotCurr, nodes: ["S'", v, u] });
          baseEdges.push({ u: "S", v: u, faces: [fPrev, fCurr], isInternal: false });
          baseEdges.push({ u: "S'", v: u, faces: [fBotPrev, fBotCurr], isInternal: false });
          baseEdges.push({ u, v, faces: [fCurr, fBotCurr], isInternal: false });
        } else {
          baseEdges.push({ u: "S", v: u, faces: [fPrev, fCurr], isInternal: false });
          baseEdges.push({ u, v, faces: [fCurr, bottomIds.join("")], isInternal: false });
        }

        if (i < n) {
          const mId = i < 5 ? midLetters[i] : `M${i + 1}`;
          derivedMidpoints.push({
            id: mId,
            p1: "S",
            p2: u,
            ratio: 0.5,
            desc: `Trung điểm ${mId} (S${u})`
          });
        }
      }

      if (n >= 4) {
        baseVertices.O = { x: 0, y: Number((-hHalf * 0.78).toFixed(3)), z: 0,
          label: "O", role: "vertex", desc: "Tâm đáy O" };
        baseEdges.push({ u: "S", v: "O", faces: [], isInternal: true });
      }

      const demoNodes = derivedMidpoints.map((m) => m.id);
      const demoSegments = [];
      for (let i = 0; i < demoNodes.length; i++) {
        demoSegments.push({ u: demoNodes[i], v: demoNodes[(i + 1) % demoNodes.length] });
      }

      return {
        title: title || `Hình chóp ${n}-giác S.${bottomIds.join("")}`,
        defaultProblem: `Cho ${title || `hình chóp S.${bottomIds.join("")}`}. Dựng thiết diện đi qua các trung điểm trên cạnh bên.`,
        baseVertices,
        derivedMidpoints,
        faces,
        baseEdges,
        initialSegments: [],
        initialFocused: [],
        demoSegments,
        demoFocused: demoNodes
      };
    }

    const topScale = family === "FRUSTUM" ? 0.58 : 1.0;
    const shiftX = apexStyle === "OBLIQUE" ? 0.45 : 0.0;
    const topIds = [];

    for (let i = 0; i < n; i++) {
      const u = bottomIds[i];
      const topId = `${u}'`;
      topIds.push(topId);
      baseVertices[topId] = {
        x: Number((baseVertices[u].x * topScale + shiftX).toFixed(3)),
        y: Number((hHalf * 0.95).toFixed(3)),
        z: Number((baseVertices[u].z * topScale).toFixed(3)),
        label: topId,
        role: "vertex",
        desc: `Đỉnh trên ${topId}`
      };
    }

    const topFaceId = topIds.join("");
    const botFaceId = bottomIds.join("");
    faces.push({ id: topFaceId, nodes: [...topIds] });
    faces.push({ id: botFaceId, nodes: [...bottomIds].reverse() });

    for (let i = 0; i < n; i++) {
      const u = bottomIds[i];
      const v = bottomIds[(i + 1) % n];
      const prev = bottomIds[(i - 1 + n) % n];
      const uTop = topIds[i];
      const vTop = topIds[(i + 1) % n];
      const prevTop = topIds[(i - 1 + n) % n];

      const sideFaceId = `${u}${v}${vTop}${uTop}`;
      const prevSideFaceId = `${prev}${u}${uTop}${prevTop}`;
      faces.push({ id: sideFaceId, nodes: [u, v, vTop, uTop] });

      baseEdges.push({ u: uTop, v: vTop, faces: [topFaceId, sideFaceId], isInternal: false });
      baseEdges.push({ u, v, faces: [botFaceId, sideFaceId], isInternal: false });
      baseEdges.push({ u, v: uTop, faces: [prevSideFaceId, sideFaceId], isInternal: false });

      if (i < n) {
        const mId = i < 5 ? midLetters[i] : `M${i + 1}`;
        derivedMidpoints.push({
          id: mId,
          p1: u,
          p2: uTop,
          ratio: 0.5,
          desc: `Trung điểm ${mId} (${u}${uTop})`
        });
      }
    }

    const demoNodes = derivedMidpoints.map((m) => m.id);
    const demoSegments = demoNodes.map((u, i) => ({ u, v: demoNodes[(i + 1) % demoNodes.length] }));

    return {
      title: title || `${family === "FRUSTUM" ? "Hình chóp cụt" : "Hình lăng trụ"} ${botFaceId}.${topFaceId}`,
      defaultProblem: `Cho ${title || `khối đa diện ${botFaceId}.${topFaceId}`}. Xác định thiết diện tạo bởi mặt phẳng cắt các cạnh bên.`,
      baseVertices,
      derivedMidpoints,
      faces,
      baseEdges,
      initialSegments: [],
      initialFocused: [],
      demoSegments,
      demoFocused: demoNodes
    };
  }

  static createPresetLibrary() {
    return {
      S_ABCD: {
            title: "Hình chóp tứ giác S.ABCD",
        defaultProblem:
          "Cho hình chóp S.ABCD. Gọi M, K, P, E lần lượt là trung điểm SD, AS, CS, SB. Dựng thiết diện (MKEP).",
        baseVertices: {
          S: { x: 0.0, y: 1.95, z: 0.0, label: "S", role: "vertex", desc: "Đỉnh chóp S" },
          A: { x: -1.35, y: -1.05, z: -1.05, label: "A", role: "vertex", desc: "Đỉnh đáy A" },
          B: { x: 1.75, y: -1.05, z: -0.65, label: "B", role: "vertex", desc: "Đỉnh đáy B" },
          C: { x: 0.85, y: -1.05, z: 1.55, label: "C", role: "vertex", desc: "Đỉnh đáy C" },
          D: { x: -1.85, y: -1.05, z: 0.95, label: "D", role: "vertex", desc: "Đỉnh đáy D" }
        },
        derivedMidpoints: [
          { id: "K", p1: "A", p2: "S", ratio: 0.5, desc: "Trung điểm K (AS)" },
          { id: "M", p1: "S", p2: "D", ratio: 0.5, desc: "Trung điểm M (SD)" },
          { id: "P", p1: "C", p2: "S", ratio: 0.5, desc: "Trung điểm P (CS)" },
          { id: "E", p1: "S", p2: "B", ratio: 0.5, desc: "Trung điểm E (SB)" },
          { id: "H", p1: "A", p2: "D", ratio: 0.5, desc: "Trung điểm H (AD)" },
          { id: "F", p1: "A", p2: "B", ratio: 0.5, desc: "Trung điểm F (AB)" },
          { id: "N", p1: "C", p2: "D", ratio: 0.5, desc: "Trung điểm N (CD)" },
          { id: "Q", p1: "B", p2: "C", ratio: 0.5, desc: "Trung điểm Q (BC)" },
          { id: "O", p1: "A", p2: "C", ratio: 0.5, desc: "Trung điểm O của AC" }
        ],
        faces: [
          { id: "SAB", nodes: ["S", "A", "B"] },
          { id: "SBC", nodes: ["S", "B", "C"] },
          { id: "SCD", nodes: ["S", "C", "D"] },
          { id: "SDA", nodes: ["S", "D", "A"] },
          { id: "ABCD", nodes: ["A", "D", "C", "B"] }
        ],
        baseEdges: [
          { u: "S", v: "A", faces: ["SAB", "SDA"], isInternal: false },
          { u: "S", v: "B", faces: ["SAB", "SBC"], isInternal: false },
          { u: "S", v: "C", faces: ["SBC", "SCD"], isInternal: false },
          { u: "S", v: "D", faces: ["SCD", "SDA"], isInternal: false },
          { u: "A", v: "B", faces: ["SAB", "ABCD"], isInternal: false },
          { u: "B", v: "C", faces: ["SBC", "ABCD"], isInternal: false },
          { u: "C", v: "D", faces: ["SCD", "ABCD"], isInternal: false },
          { u: "D", v: "A", faces: ["SDA", "ABCD"], isInternal: false },
          { u: "A", v: "C", faces: ["ABCD"], isInternal: true },
          { u: "S", v: "O", faces: [], isInternal: true }
        ],
        initialSegments: [{ u: "B", v: "Q" }],
        initialFocused: ["F", "P", "B"],
        demoSegments: [
          { u: "M", v: "K" },
          { u: "K", v: "E" },
          { u: "E", v: "P" },
          { u: "P", v: "M" },
          { u: "B", v: "Q" }
        ],
        demoFocused: ["M", "K", "E", "P", "F", "B"]
      },

      S_ABCD_SQUARE: GeometrySceneGraph.buildParametricPreset({
        title: "2. Hình chóp tứ giác đều S.ABCD (Đáy vuông)",
        family: "PYRAMID",
        sides: 4,
        height: 2.9,
        radius: 1.85,
        apexStyle: "CENTER"
      }),

      S_ABCD_PERP: GeometrySceneGraph.buildParametricPreset({
        title: "3. Hình chóp S.ABCD có SA ⊥ (ABCD)",
        family: "PYRAMID",
        sides: 4,
        height: 2.8,
        radius: 1.8,
        apexStyle: "PERP_A"
      }),

      S_ABC: {
        title: "4. Hình chóp tam giác (Tứ diện) S.ABC",
        defaultProblem:
          "Cho tứ diện S.ABC. Gọi M, N, P lần lượt là trung điểm SA, SB, SC. Dựng thiết diện (MNP) song song với đáy (ABC).",
        baseVertices: {
          S: { x: 0.0, y: 2.0, z: 0.0, label: "S", role: "vertex", desc: "Đỉnh chóp S" },
          A: { x: -1.75, y: -1.05, z: -0.95, label: "A", role: "vertex", desc: "Đỉnh đáy A" },
          B: { x: 1.85, y: -1.05, z: -0.75, label: "B", role: "vertex", desc: "Đỉnh đáy B" },
          C: { x: 0.1, y: -1.05, z: 1.65, label: "C", role: "vertex", desc: "Đỉnh đáy C" }
        },
        derivedMidpoints: [
          { id: "M", p1: "S", p2: "A", ratio: 0.5, desc: "Trung điểm M (SA)" },
          { id: "N", p1: "S", p2: "B", ratio: 0.5, desc: "Trung điểm N (SB)" },
          { id: "P", p1: "S", p2: "C", ratio: 0.5, desc: "Trung điểm P (SC)" },
          { id: "E", p1: "A", p2: "B", ratio: 0.5, desc: "Trung điểm E (AB)" },
          { id: "F", p1: "B", p2: "C", ratio: 0.5, desc: "Trung điểm F (BC)" },
          { id: "K", p1: "A", p2: "C", ratio: 0.5, desc: "Trung điểm K (AC)" }
        ],
        faces: [
          { id: "SAB", nodes: ["S", "A", "B"] },
          { id: "SBC", nodes: ["S", "B", "C"] },
          { id: "SCA", nodes: ["S", "C", "A"] },
          { id: "ABC", nodes: ["A", "C", "B"] }
        ],
        baseEdges: [
          { u: "S", v: "A", faces: ["SAB", "SCA"], isInternal: false },
          { u: "S", v: "B", faces: ["SAB", "SBC"], isInternal: false },
          { u: "S", v: "C", faces: ["SBC", "SCA"], isInternal: false },
          { u: "A", v: "B", faces: ["SAB", "ABC"], isInternal: false },
          { u: "B", v: "C", faces: ["SBC", "ABC"], isInternal: false },
          { u: "C", v: "A", faces: ["SCA", "ABC"], isInternal: false }
        ],
        initialSegments: [],
        initialFocused: [],
        demoSegments: [
          { u: "M", v: "N" },
          { u: "N", v: "P" },
          { u: "P", v: "M" }
        ],
        demoFocused: ["M", "N", "P"]
      },

      S_ABC_PERP: GeometrySceneGraph.buildParametricPreset({
        title: "5. Hình chóp S.ABC có SA ⊥ (ABC)",
        family: "PYRAMID",
        sides: 3,
        height: 2.75,
        radius: 1.85,
        apexStyle: "PERP_A"
      }),

      PRISM_ABC: {
        title: "6. Hình lăng trụ tam giác ABC.A'B'C'",
        defaultProblem:
          "Cho lăng trụ tam giác ABC.A'B'C'. Gọi M, N là trung điểm AA', BB'. Dựng thiết diện đi qua M, N và đỉnh C.",
        baseVertices: {
          "A'": { x: -1.55, y: 1.4, z: -0.85, label: "A'", role: "vertex", desc: "Đỉnh trên A'" },
          "B'": { x: 1.55, y: 1.4, z: -0.65, label: "B'", role: "vertex", desc: "Đỉnh trên B'" },
          "C'": { x: 0.05, y: 1.4, z: 1.45, label: "C'", role: "vertex", desc: "Đỉnh trên C'" },
          A: { x: -1.55, y: -1.25, z: -0.85, label: "A", role: "vertex", desc: "Đỉnh đáy A" },
          B: { x: 1.55, y: -1.25, z: -0.65, label: "B", role: "vertex", desc: "Đỉnh đáy B" },
          C: { x: 0.05, y: -1.25, z: 1.45, label: "C", role: "vertex", desc: "Đỉnh đáy C" }
        },
        derivedMidpoints: [
          { id: "M", p1: "A", p2: "A'", ratio: 0.5, desc: "Trung điểm M (AA')" },
          { id: "N", p1: "B", p2: "B'", ratio: 0.5, desc: "Trung điểm N (BB')" },
          { id: "P", p1: "C", p2: "C'", ratio: 0.5, desc: "Trung điểm P (CC')" },
          { id: "E", p1: "A", p2: "B", ratio: 0.5, desc: "Trung điểm E (AB)" },
          { id: "F", p1: "B", p2: "C", ratio: 0.5, desc: "Trung điểm F (BC)" }
        ],
        faces: [
          { id: "A'B'C'", nodes: ["A'", "B'", "C'"] },
          { id: "ABC", nodes: ["A", "C", "B"] },
          { id: "ABB'A'", nodes: ["A", "B", "B'", "A'"] },
          { id: "BCC'B'", nodes: ["B", "C", "C'", "B'"] },
          { id: "CAA'C'", nodes: ["C", "A", "A'", "C'"] }
        ],
        baseEdges: [
          { u: "A'", v: "B'", faces: ["A'B'C'", "ABB'A'"], isInternal: false },
          { u: "B'", v: "C'", faces: ["A'B'C'", "BCC'B'"], isInternal: false },
          { u: "C'", v: "A'", faces: ["A'B'C'", "CAA'C'"], isInternal: false },
          { u: "A", v: "B", faces: ["ABC", "ABB'A'"], isInternal: false },
          { u: "B", v: "C", faces: ["ABC", "BCC'B'"], isInternal: false },
          { u: "C", v: "A", faces: ["ABC", "CAA'C'"], isInternal: false },
          { u: "A", v: "A'", faces: ["ABB'A'", "CAA'C'"], isInternal: false },
          { u: "B", v: "B'", faces: ["ABB'A'", "BCC'B'"], isInternal: false },
          { u: "C", v: "C'", faces: ["BCC'B'", "CAA'C'"], isInternal: false }
        ],
        initialSegments: [],
        initialFocused: [],
        demoSegments: [
          { u: "M", v: "N" },
          { u: "N", v: "C" },
          { u: "C", v: "M" }
        ],
        demoFocused: ["M", "N", "C"]
      },

      CUBE_ABCD: {
        title: "7. Hình lập phương ABCD.A'B'C'D'",
        defaultProblem:
          "Cho hình lập phương ABCD.A'B'C'D'. Dựng thiết diện tạo bởi mặt phẳng đi qua các đỉnh A', C' và B.",
        baseVertices: {
          "A'": { x: -1.4, y: 1.35, z: -1.2, label: "A'", role: "vertex", desc: "Đỉnh A'" },
          "B'": { x: 1.4, y: 1.35, z: -1.2, label: "B'", role: "vertex", desc: "Đỉnh B'" },
          "C'": { x: 1.4, y: 1.35, z: 1.2, label: "C'", role: "vertex", desc: "Đỉnh C'" },
          "D'": { x: -1.4, y: 1.35, z: 1.2, label: "D'", role: "vertex", desc: "Đỉnh D'" },
          A: { x: -1.4, y: -1.35, z: -1.2, label: "A", role: "vertex", desc: "Đỉnh A" },
          B: { x: 1.4, y: -1.35, z: -1.2, label: "B", role: "vertex", desc: "Đỉnh B" },
          C: { x: 1.4, y: -1.35, z: 1.2, label: "C", role: "vertex", desc: "Đỉnh C" },
          D: { x: -1.4, y: -1.35, z: 1.2, label: "D", role: "vertex", desc: "Đỉnh D" }
        },
        derivedMidpoints: [
          { id: "M", p1: "A'", p2: "D'", ratio: 0.5, desc: "Trung điểm M (A'D')" },
          { id: "N", p1: "A'", p2: "B'", ratio: 0.5, desc: "Trung điểm N (A'B')" },
          { id: "P", p1: "B", p2: "C", ratio: 0.5, desc: "Trung điểm P (BC)" },
          { id: "Q", p1: "C", p2: "D", ratio: 0.5, desc: "Trung điểm Q (CD)" },
          { id: "O", p1: "A", p2: "C", ratio: 0.5, desc: "Tâm đáy O (AC)" }
        ],
        faces: [
          { id: "A'B'C'D'", nodes: ["A'", "B'", "C'", "D'"] },
          { id: "ABCD", nodes: ["A", "D", "C", "B"] },
          { id: "ABB'A'", nodes: ["A", "B", "B'", "A'"] },
          { id: "BCC'B'", nodes: ["B", "C", "C'", "B'"] },
          { id: "CDD'C'", nodes: ["C", "D", "D'", "C'"] },
          { id: "DAA'D'", nodes: ["D", "A", "A'", "D'"] }
        ],
        baseEdges: [
          { u: "A'", v: "B'", faces: ["A'B'C'D'", "ABB'A'"], isInternal: false },
          { u: "B'", v: "C'", faces: ["A'B'C'D'", "BCC'B'"], isInternal: false },
          { u: "C'", v: "D'", faces: ["A'B'C'D'", "CDD'C'"], isInternal: false },
          { u: "D'", v: "A'", faces: ["A'B'C'D'", "DAA'D'"], isInternal: false },
          { u: "A", v: "B", faces: ["ABCD", "ABB'A'"], isInternal: false },
          { u: "B", v: "C", faces: ["ABCD", "BCC'B'"], isInternal: false },
          { u: "C", v: "D", faces: ["ABCD", "CDD'C'"], isInternal: false },
          { u: "D", v: "A", faces: ["ABCD", "DAA'D'"], isInternal: false },
          { u: "A", v: "A'", faces: ["ABB'A'", "DAA'D'"], isInternal: false },
          { u: "B", v: "B'", faces: ["ABB'A'", "BCC'B'"], isInternal: false },
          { u: "C", v: "C'", faces: ["BCC'B'", "CDD'C'"], isInternal: false },
          { u: "D", v: "D'", faces: ["CDD'C'", "DAA'D'"], isInternal: false }
        ],
        initialSegments: [],
        initialFocused: [],
        demoSegments: [
          { u: "A'", v: "C'" },
          { u: "C'", v: "B" },
          { u: "B", v: "A'" }
        ],
        demoFocused: ["A'", "C'", "B"]
      },

      PRISM_OBLIQUE_ABCD: GeometrySceneGraph.buildParametricPreset({
        title: "8. Hình hộp xiên ABCD.A'B'C'D'",
        family: "PRISM",
        sides: 4,
        height: 2.6,
        radius: 1.7,
        apexStyle: "OBLIQUE"
      }),

      FRUSTUM_ABCD: GeometrySceneGraph.buildParametricPreset({
        title: "9. Hình chóp cụt tứ giác đều ABCD.A'B'C'D'",
        family: "FRUSTUM",
        sides: 4,
        height: 2.5,
        radius: 1.85,
        apexStyle: "CENTER"
      }),

      PYRAMID_HEX: GeometrySceneGraph.buildParametricPreset({
        title: "10. Hình chóp lục giác đều S.ABCDEF",
        family: "PYRAMID",
        sides: 6,
        height: 2.9,
        radius: 1.8,
        apexStyle: "CENTER"
      }),

      OCTAHEDRON: GeometrySceneGraph.buildParametricPreset({
        title: "11. Khối bát diện đều S.ABCD.S'",
        family: "BIPYRAMID",
        sides: 4,
        height: 2.2,
        radius: 1.75,
        apexStyle: "CENTER"
      })
    };
  }

  registerNewPreset(presetKey, presetObj) {
    this.presets[presetKey] = presetObj;
    this.loadPreset(presetKey);
  }

  loadPreset(presetKey) {
    this.invalidateGeometry();
    const preset = this.presets[presetKey] || this.presets.S_ABCD;
    this.currentPresetKey = this.presets[presetKey] ? presetKey : "S_ABCD";
    this.currentPresetDefinition = JSON.parse(JSON.stringify(preset));
    this.problemStatement = preset.defaultProblem;
    this.baseVertices = JSON.parse(JSON.stringify(preset.baseVertices));
    this.derivedMidpoints = JSON.parse(JSON.stringify(preset.derivedMidpoints));
    this.faces = JSON.parse(JSON.stringify(preset.faces));
    this.baseEdges = JSON.parse(JSON.stringify(preset.baseEdges));
    this.customPoints = [];
    this.spatialConstruction = emptySpatial();
    this.solidId = undefined;
    this.hiddenPointIds = [];
    this.lockedPointIds = [];
    this.pointIds = new Map();
    this.pointSequence = 0;
    for (const label of [...Object.keys(this.baseVertices), ...this.derivedMidpoints.map(p => p.id)]) {
      this.pointIds.set(label, 'p:' + label);
    }

    this.userSegments = this.showPresetMidpoints
      ? JSON.parse(JSON.stringify(preset.initialSegments || []))
      : [];
    this.focusedNodes = new Set(
      this.showPresetMidpoints ? preset.initialFocused || [] : []
    );
    this.activeAnchorNode = null;
    this.historyStack = [];
    this.redoStack = [];
  }

  invalidateGeometry() { this.geometryRevision++; }

  pushHistorySnapshot(kind = 'geometry') {
    if (kind === 'style') this.styleRevision++;
    else this.invalidateGeometry();
    const snapshot = this.exportLessonJSON();
    if (
      this.historyStack.length === 0 ||
      this.historyStack[this.historyStack.length - 1] !== snapshot
    ) {
      this.historyStack.push(snapshot);
      if (this.historyStack.length > 40) this.historyStack.shift();
      this.redoStack = [];
    }
    this.onMutation?.();
  }

  restoreSnapshot(snapshotStr) {
    if (!snapshotStr) return false;
    try {
      const input = typeof snapshotStr === 'string' ? JSON.parse(snapshotStr) : snapshotStr;
      const data = input?.version === '8.0' ? legacyProjection(input)
        : normalizeSnapshot(input, input?.presetDefinition ?? this.presets[input?.presetKey]);
      const preset = data.presetDefinition ?? this.presets[data.presetKey] ?? (input.version === '8.0' ? {
        title: data.title || data.presetKey, defaultProblem: data.problemStatement,
        baseVertices: data.baseVertices, derivedMidpoints: data.derivedMidpoints,
        faces: data.faces, baseEdges: data.baseEdges
      } : null);
      if (!preset) return false;
      const { baseVertices: vertices, derivedMidpoints: mids, faces, baseEdges: edges,
        hiddenPointIds: hidden, lockedPointIds: locked } = data;
      const labels = [...Object.keys(vertices), ...mids.map(p => p.id), ...data.customPoints.map(p => p.id)];
      this.pointIds = new Map(labels.map(label => [label, data.pointIds?.[label] ?? 'p:' + label]));
      this.pointSequence = data.pointSequence ?? 0;
      if (!this.presets[data.presetKey] || (data.presetDefinition && data.presetKey.startsWith('CUSTOM_'))) {
        this.presets[data.presetKey] = JSON.parse(JSON.stringify(preset));
      }
      this.currentPresetDefinition = JSON.parse(JSON.stringify(preset));
      this.currentPresetKey = data.presetKey || "S_ABCD";
      this.problemStatement = String(data.problemStatement ?? preset.defaultProblem ?? "");
      this.baseVertices = vertices;
      this.derivedMidpoints = mids;
      this.hiddenPointIds = hidden;
      this.lockedPointIds = locked;
      this.faces = faces;
      this.baseEdges = edges;

      this.showPresetMidpoints =
        data.showPresetMidpoints !== undefined ? Boolean(data.showPresetMidpoints) : true;
      this.customPoints = Array.isArray(data.customPoints) ? data.customPoints : [];
      this.spatialConstruction = { ...emptySpatial(), ...data.spatialConstruction };
      this.solidId = data.solidId;
      this.userSegments = Array.isArray(data.userSegments) ? data.userSegments : [];
      this.focusedNodes = new Set(Array.isArray(data.focusedNodes) ? data.focusedNodes : []);
      this.activeAnchorNode = null;
      this.invalidateGeometry();
      return true;
    } catch (e) {
      return false;
    }
  }

  undo() {
    if (this.historyStack.length === 0) return false;
    const currentSnap = this.exportLessonJSON();
    if (!this.restoreSnapshot(this.historyStack.at(-1))) return false;
    this.redoStack.push(currentSnap);
    this.historyStack.pop();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const currentSnap = this.exportLessonJSON();
    if (!this.restoreSnapshot(this.redoStack.at(-1))) return false;
    this.historyStack.push(currentSnap);
    this.redoStack.pop();
    return true;
  }

  synchronizePointIds() {
    const labels = [...Object.keys(this.baseVertices), ...this.derivedMidpoints.map(p => p.id), ...this.customPoints.map(p => p.id)];
    const used = new Set(this.pointIds.values());
    for (const label of labels) {
      if (this.pointIds.has(label)) continue;
      let id;
      do { id = 'p:new:' + (++this.pointSequence); } while (used.has(id));
      this.pointIds.set(label, id);
      used.add(id);
    }
    const live = new Set(labels);
    for (const label of this.pointIds.keys()) if (!live.has(label)) this.pointIds.delete(label);
    return Object.fromEntries(labels.map(label => [label, this.pointIds.get(label)]));
  }

  exportModel(cameraQuat = null) { return migrateLegacy(this.exportLessonObject(cameraQuat)); }

  exportLessonObject(cameraQuat = null) {
    return {
      version: "7.0",
      pointIds: this.synchronizePointIds(),
      pointSequence: this.pointSequence,
      lockedPointIds: [...(this.lockedPointIds || [])],
      hiddenPointIds: [...(this.hiddenPointIds || [])],
      presetKey: this.currentPresetKey,
      presetDefinition: this.currentPresetDefinition || this.presets[this.currentPresetKey],
      problemStatement: this.problemStatement,
      baseVertices: this.baseVertices,
      derivedMidpoints: this.derivedMidpoints,
      faces: this.faces,
      baseEdges: this.baseEdges,
      showPresetMidpoints: this.showPresetMidpoints,
      customPoints: this.customPoints,
      userSegments: this.userSegments,
      ...(Object.values(this.spatialConstruction).some(items => items.length) && { spatialConstruction: this.spatialConstruction }),
      ...(this.solidId && { solidId:this.solidId }),
      focusedNodes: Array.from(this.focusedNodes),
      cameraQuaternion: cameraQuat
        ? [cameraQuat.w, cameraQuat.x, cameraQuat.y, cameraQuat.z]
        : [1, 0, 0, 0]
    };
  }

  exportLessonJSON(cameraQuat = null) {
    return JSON.stringify(this.exportLessonObject(cameraQuat), null, 2);
  }

  addCustomPointOnSegment(id, p1, p2, ratio = 0.5) {
    const cleanId = normalizePointLabel(id);
    const nodes = this.computeAllNodes3D();
    ratio = Number(ratio);
    if (!validPointLabel(cleanId) || nodes[cleanId] || this.getSpatialPoint(cleanId) ||
        !nodes[p1] || !nodes[p2] || p1 === p2 || !Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return null;
    this.pushHistorySnapshot();

    const ratioLabel =
      Math.abs(ratio - 0.5) < 0.01
        ? "Trung điểm"
        : `Điểm chia tỉ lệ ${ratio.toFixed(2)}`;
    const desc = `${ratioLabel} ${cleanId} (${p1}${p2})`;

    const existingIdx = this.customPoints.findIndex((pt) => pt.id === cleanId);
    if (existingIdx !== -1) {
      this.customPoints[existingIdx] = { id: cleanId, p1, p2, ratio, desc };
    } else {
      this.customPoints.push({ id: cleanId, p1, p2, ratio, desc });
    }
    this.focusedNodes.add(cleanId);
    return cleanId;
  }

  updatePointRatioOnEdge(nodeId, newRatio) {
    const ratio = Number(newRatio), point = this.getPointDefinition(nodeId);
    if (!point || this.isPointLocked(nodeId) || !Number.isFinite(ratio)) return null;
    const next = Math.max(0.01, Math.min(0.99, ratio));
    if (point.ratio !== next) this.invalidateGeometry();
    point.ratio = next;
    point.desc = (Math.abs(point.ratio - 0.5) < 1e-7 ? 'Trung điểm ' : 'Điểm tỉ lệ ') + point.id + ' (' + point.p1 + point.p2 + ')';
    return point;
  }

  getPointDefinition(nodeId) {
    return (
      this.derivedMidpoints.find((m) => m.id === nodeId) ||
      this.customPoints.find((c) => c.id === nodeId) ||
      null
    );
  }

  addFreeVertex3D(id, x, y, z) {
    const cleanId = normalizePointLabel(id);
    if (!validPointLabel(cleanId) || this.computeAllNodes3D()[cleanId] || this.getSpatialPoint(cleanId) ||
        ![x, y, z].every(v => v !== "" && Number.isFinite(Number(v)))) return null;
    this.pushHistorySnapshot();
    this.baseVertices[cleanId] = {
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      label: cleanId,
      role: "vertex",
      desc: `Đỉnh tự tạo ${cleanId}`
    };
    this.focusedNodes.add(cleanId);
    return cleanId;
  }

  computeAllNodes3D() {
    const nodes = ConstructionGraph.solve(this.baseVertices,
      [...this.derivedMidpoints.map(p => ({ ...p, preset: true })), ...this.customPoints],
      this.hiddenPointIds || [], this.showPresetMidpoints);
    for (const p of Object.values(nodes)) p.locked = this.isPointLocked(p.id);
    if (this.spatialConstruction.points.length) for (const point of this.spatialConstruction.points) {
      const result = this.resolvedSpatial().get(point.id);
      if (result?.status !== 'defined') continue;
      nodes[point.label] = { ...result.value, id: point.label, role: 'edgepoint', kind: 'SPATIAL',
        desc: this.spatialPointDescription(point.label), hidden: !!point.hidden || this.hiddenPointIds.includes(point.label),
        locked: this.isPointLocked(point.label) };
    }
    return nodes;
  }

  resolvedSpatial() {
    if (this.spatialRevision !== this.geometryRevision) {
      this.spatialResolved = resolveModel(this.exportModel());
      this.spatialRevision = this.geometryRevision;
    }
    return this.spatialResolved;
  }

  properties() {
    if(this.propertyRevision!==this.geometryRevision){
      const model=this.exportModel();
      this.propertyResults=analyzeGeometry(model,this.resolvedSpatial());
      this.propertyRevision=this.geometryRevision;
    }
    return this.propertyResults;
  }

  createPlane(labels, history = true) {
    if(labels.length!==3||new Set(labels).size!==3)return null;
    const nodes=this.computeAllNodes3D();
    if(!planeThrough(...labels.map(id=>nodes[id])))return null;
    const points=labels.map(label=>this.pointKey(label));
    const prior=this.spatialConstruction.planes.find(p=>points.every(id=>p.points.includes(id)));
    if(prior)return prior;
    if(history)this.pushHistorySnapshot();
    const plane={id:this.spatialId('plane'),points};
    this.spatialConstruction.planes.push(plane);
    this.invalidateGeometry();
    return plane;
  }

  createSection(planeId, history = true) {
    if(!this.spatialConstruction.planes.some(p=>p.id===planeId))return null;
    const solid=this.exportModel().solids[0].id;
    const prior=this.spatialConstruction.sections.find(s=>s.solid===solid&&s.plane===planeId);
    if(prior)return prior;
    if(history)this.pushHistorySnapshot();
    const section={id:this.spatialId('section'),solid,plane:planeId};
    this.solidId=solid;
    this.spatialConstruction.sections.push(section);
    this.invalidateGeometry();
    return section;
  }

  createSectionThrough(labels) {
    if (labels.length !== 3 || new Set(labels).size !== 3) return null;
    const nodes = this.computeAllNodes3D();
    if (!planeThrough(...labels.map(id => nodes[id]))) return null;
    const points = labels.map(id => this.pointKey(id));
    const existing = this.spatialConstruction.planes.find(plane => points.every(id => plane.points.includes(id)));
    const previous = existing && this.spatialConstruction.sections.find(section => section.plane === existing.id);
    if (previous) return previous;
    this.pushHistorySnapshot();
    const plane = existing ?? this.createPlane(labels, false);
    return this.createSection(plane.id, false);
  }

  sectionPlaneOptions() {
    this.synchronizePointIds();
    const labels=new Map([...this.pointIds].map(([label,id])=>[id,label]));
    for(const p of this.spatialConstruction.points)labels.set(p.id,p.label);
    return [...this.faces.map(face=>({id:'face:'+face.id,label:'Mặt hữu hạn ('+face.nodes.join('')+')',labels:face.nodes,face})),
      ...this.spatialConstruction.planes.map(plane=>{
        const names=plane.points.map(id=>labels.get(id));
        return {id:plane.id,label:'Mặt phẳng ('+names.join('')+')',labels:names,plane};
      })];
  }

  comparePlanes(firstId, secondId) {
    const options=this.sectionPlaneOptions(), first=options.find(o=>o.id===firstId), second=options.find(o=>o.id===secondId);
    if(!first||!second)return null;
    const nodes=this.computeAllNodes3D();
    const points=o=>o.labels.map(id=>nodes[id]);
    const plane=o=>o.plane?this.resolvedSpatial().get(o.id)?.value:planeThrough(...points(o).slice(0,3));
    return {infinite:intersectPlanes(plane(first),plane(second)),
      finite:first.face&&second.face?intersectFiniteFaces(points(first),points(second)):null,first,second};
  }

  getSpatialPoint(label) { return this.spatialConstruction.points.find(p => p.label === label); }

  spatialPointDescription(label) {
    const p = this.getSpatialPoint(label);
    if (!p) return '';
    const result = this.resolvedSpatial().get(p.id);
    const reasons = { parallel: 'song song', skew: 'hai đường chéo nhau', coincident: 'hai đường trùng nhau',
      contained: 'đường nằm trong mặt phẳng', 'outside-domain': 'giao nằm ngoài miền',
      'ill-conditioned': 'gần song song', 'undefined-parent': 'đối tượng cha không xác định',
      'degenerate-linear': 'đường suy biến', degenerate: 'đối tượng suy biến' };
    if (result?.status !== 'defined') return 'Không xác định · ' + (reasons[result?.reason] ?? 'thiếu dữ kiện');
    return p.definition.kind === 'onLinear' ? 'Điểm trên đường · t = ' + p.definition.t
      : ['intersectionLL', 'intersectionLP'].includes(p.definition.kind) ? 'Giao điểm 3D' : 'Điểm dựng';
  }

  pointKey(label) { return this.getSpatialPoint(label)?.id ?? this.synchronizePointIds()[label]; }

  spatialId(kind) {
    const used = new Set([...this.pointIds.values(), ...Object.values(this.spatialConstruction).flatMap(items => items.map(i => i.id))]);
    let id;
    do { id = 'spatial:' + kind + ':' + (++this.pointSequence); } while (used.has(id));
    return id;
  }

  linearRefs() {
    this.synchronizePointIds();
    const labels = new Map([...this.pointIds].map(([label,id]) => [id,label]));
    for (const p of this.spatialConstruction.points) labels.set(p.id, p.label);
    return [
      ...this.baseEdges.filter(e => !e.hidden).map(e => ({ type: 'BASE', u: e.u, v: e.v, kind: 'segment' })),
      ...this.userSegments.map(e => ({ type: 'USER', u: e.u, v: e.v, kind: 'segment' })),
      ...this.spatialConstruction.linears.filter(l => !l.constructionOnly).map(l =>
        ({ type: 'SPATIAL', linearId: l.id, u: labels.get(l.points[0]), v: labels.get(l.points[1]), kind: l.kind }))
    ];
  }

  spatialLinearRef(id) { return this.linearRefs().find(ref => ref.linearId === id); }

  findSpatialSupport(ref, kind) {
    const a = this.pointKey(ref.u), b = this.pointKey(ref.v);
    return this.spatialConstruction.linears.find(l => l.baseSource && l.kind === kind && l.points[0] === a && l.points[1] === b);
  }

  linearGeometry(ref, nodes) {
    if (!ref) return null;
    if (ref.type === 'SPATIAL') return this.resolvedSpatial().get(ref.linearId)?.value ?? null;
    const list = ref.type === 'BASE' ? this.baseEdges : this.userSegments;
    const edge = list.find(e => sameEnds(e, ref));
    if (!edge) return null;
    nodes ??= this.computeAllNodes3D();
    const a = nodes[ref.u], b = nodes[ref.v];
    return a && b ? { origin: a, direction: Vec3.sub(b, a), kind: 'segment' } : null;
  }

  materializeLinear(ref, kind, visible = true) {
    if (ref.type === 'SPATIAL') {
      const line = this.spatialConstruction.linears.find(l => l.id === ref.linearId);
      line.kind = kind;
      if (visible) delete line.constructionOnly;
      return line;
    }
    const points = [this.pointKey(ref.u), this.pointKey(ref.v)];
    const list = ref.type === 'BASE' ? this.baseEdges : this.userSegments;
    const source = list.find(edge => sameEnds(edge, ref));
    const base = ref.type === 'BASE';
    if (base) {
      const existing = this.spatialConstruction.linears.find(l => l.baseSource && l.kind === kind &&
        l.points[0] === points[0] && l.points[1] === points[1]);
      if (existing) {
        if (visible) delete existing.constructionOnly;
        return existing;
      }
    } else this.userSegments = this.userSegments.filter(e => e !== source);
    const line = { id: this.spatialId('line'), kind, points, style: source?.style ?? source?.forceStyle ?? 'AUTO',
      ...(base && { baseSource: true }), ...(!visible && base && { constructionOnly: true }) };
    this.spatialConstruction.linears.push(line);
    return line;
  }

  changeLinearKind(ref, kind) {
    const geometry = this.linearGeometry(ref);
    if (!geometry || !['segment', 'ray', 'line'].includes(kind) || geometry.kind === kind) return null;
    if (this.spatialConstruction.points.some(p => p.definition.kind === 'onLinear' &&
      p.definition.linear === ref.linearId && !parameterInDomain(kind, p.definition.t))) return null;
    this.pushHistorySnapshot();
    return this.materializeLinear(ref, kind);
  }

  createPointOnLinear(ref, t) {
    const geometry = this.linearGeometry(ref);
    if (!geometry || Vec3.len(geometry.direction) === 0 || !parameterInDomain(geometry.kind, t) ||
        !Object.values(Vec3.add(geometry.origin, Vec3.scale(geometry.direction, t))).every(Number.isFinite)) return null;
    if (t === 0 || t === 1) return t === 0 ? ref.u : ref.v;
    const linearId = ref.linearId ?? (ref.type === 'BASE' ? this.findSpatialSupport(ref, geometry.kind)?.id : null);
    const existing = this.spatialConstruction.points.find(p => p.definition.kind === 'onLinear' &&
      p.definition.linear === linearId && Math.abs(p.definition.t - t) < 1e-9);
    if (existing) return existing.label;
    const label = this.nextPointId();
    if (!label) return null;
    this.pushHistorySnapshot();
    const line = this.materializeLinear(ref, geometry.kind, false);
    this.spatialConstruction.points.push({ id: this.spatialId('point'), label, definition: { kind: 'onLinear', linear: line.id, t } });
    return label;
  }

  setSpatialParameter(label, t, save = true) {
    const point = this.getSpatialPoint(label), d = point?.definition;
    const line = this.spatialConstruction.linears.find(l => l.id === d?.linear);
    if (d?.kind !== 'onLinear' || !line || this.isPointLocked(label) || !parameterInDomain(line.kind, t) || d.t === t) return false;
    const geometry = this.linearGeometry({ type: 'SPATIAL', linearId: line.id });
    if (!geometry || !Object.values(Vec3.add(geometry.origin, Vec3.scale(geometry.direction,t))).every(Number.isFinite)) return false;
    if (save) this.pushHistorySnapshot(); else this.invalidateGeometry();
    d.t = t;
    return true;
  }

  intersectionPreview(first, second, extend = false) {
    const a = this.linearGeometry(first);
    if (!a || !second) return { status: 'degenerate' };
    if (second.planeId) return intersectLinearPlane(extend ? { ...a, kind: 'line' } : a,
      this.resolvedSpatial().get(second.planeId)?.value);
    if (second.faceId) {
      const face = this.faces.find(f => f.id === second.faceId);
      const world = this.computeAllNodes3D();
      const labels = face?.nodes.slice(0, 3);
      const [p, q, r] = labels?.map(id => world[id]) ?? [];
      if (!p || !q || !r) return { status: 'degenerate' };
      const normal = Vec3.cross(Vec3.sub(q, p), Vec3.sub(r, p));
      return intersectLinearPlane(extend ? { ...a, kind: 'line' } : a, { origin: p, normal });
    }
    const b = this.linearGeometry(second);
    return intersectLinears(extend ? { ...a, kind: 'line' } : a, extend && b ? { ...b, kind: 'line' } : b);
  }

  createSpatialMidpoint(u, v) {
    if (u === v || !this.computeAllNodes3D()[u] || !this.computeAllNodes3D()[v]) return null;
    const points = [this.pointKey(u), this.pointKey(v)];
    const old = this.spatialConstruction.points.find(p => p.definition.kind === 'midpoint' &&
      points.every(id => p.definition.points.includes(id)));
    if (old) return old.label;
    const label = this.nextPointId();
    if (!label) return null;
    this.pushHistorySnapshot();
    this.spatialConstruction.points.push({ id: this.spatialId('point'), label, definition: { kind: 'midpoint', points } });
    return label;
  }

  createSpatialIntersection(first, second, extend = false) {
    const normal = this.intersectionPreview(first, second);
    if (extend && normal.status !== 'outside-domain') return null;
    const result = extend ? this.intersectionPreview(first, second, true) : normal;
    if (result.status !== 'intersect') return null;
    const face = second.faceId && this.faces.find(f => f.id === second.faceId);
    const usePlane = Boolean(face || second.planeId);
    const planePoints = face ? face.nodes.slice(0, 3).map(id => this.pointKey(id)) : null;
    const plane = second.planeId ? this.spatialConstruction.planes.find(p => p.id === second.planeId)
      : planePoints && this.spatialConstruction.planes.find(p => p.points.every(id => planePoints.includes(id)));
    if (!extend && usePlane) {
      const endpoint = result.t === 0 ? first.u : result.t === 1 ? first.v : null;
      if (endpoint && (face?.nodes.includes(endpoint) || plane?.points.includes(this.pointKey(endpoint)))) return endpoint;
    }
    const linearId = ref => ref.linearId ?? (ref.type === 'BASE' ? this.findSpatialSupport(ref, 'segment')?.id : null);
    const aId = linearId(first), bId = usePlane ? null : linearId(second);
    if (!extend && !usePlane) {
      const shared = [first.u, first.v].find(id => id === second.u || id === second.v);
      if (shared) return shared;
    }
    const existing = !extend && this.spatialConstruction.points.find(({ definition: d }) => usePlane
      ? d.kind === 'intersectionLP' && d.linear === aId && d.plane === plane?.id
      : d.kind === 'intersectionLL' && aId && bId && d.linears.includes(aId) && d.linears.includes(bId));
    if (existing) return existing.label;
    const label = this.nextPointId();
    if (!label) return null;
    this.pushHistorySnapshot();
    const parent = (ref, t) => {
      const kind = this.linearGeometry(ref)?.kind;
      return this.materializeLinear(ref, extend && !parameterInDomain(kind, t) ? 'line' : kind,
        extend && !parameterInDomain(kind, t));
    };
    const a = parent(first, result.t);
    let definition;
    if (usePlane) {
      const p = plane ?? { id: this.spatialId('plane'), points: planePoints };
      if (!plane) this.spatialConstruction.planes.push(p);
      definition = { kind: 'intersectionLP', linear: a.id, plane: p.id };
    } else definition = { kind: 'intersectionLL', linears: [a.id, parent(second, result.u).id] };
    this.spatialConstruction.points.push({ id: this.spatialId('point'), label, definition });
    this.invalidateGeometry();
    return label;
  }

  nextPointId() {
    const names = new Set([...Object.keys(this.baseVertices), ...this.derivedMidpoints.map(p => p.id),
      ...this.customPoints.map(p => p.id), ...this.spatialConstruction.points.map(p => p.label)]);
    return ['I', 'J', 'L', 'R', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].find(id => !names.has(id)) ||
      Array.from({ length: 300 }, (_, i) => 'P' + (i + 1)).find(id => !names.has(id));
  }

  detachPoint(id) {
    const point = this.computeAllNodes3D()[id], def = this.getPointDefinition(id);
    if (!point || !def || this.isPointLocked(id)) return false;
    this.pushHistorySnapshot();
    this.derivedMidpoints = this.derivedMidpoints.filter(p => p.id !== id);
    this.customPoints = this.customPoints.filter(p => p.id !== id);
    this.baseVertices[id] = { x: point.x, y: point.y, z: point.z, free: true, desc: 'Điểm tự do ' + id };
    return true;
  }

  isStructuralPoint(id) { return this.faces.some(face => face.nodes.includes(id)); }

  isPointLocked(id) { return (this.lockedPointIds || []).includes(id) || this.getSpatialPoint(id)?.locked === true; }

  setPointLocked(id, locked) {
    const spatial = this.getSpatialPoint(id);
    if ((!spatial && !this.computeAllNodes3D()[id]) || this.isPointLocked(id) === locked) return false;
    this.pushHistorySnapshot();
    this.lockedPointIds = locked ? [...this.lockedPointIds, id] : this.lockedPointIds.filter(key => key !== id);
    if (spatial) spatial.locked = locked;
    return true;
  }

  renamePoint(id, name) {
    const next = normalizePointLabel(name), nodes = this.computeAllNodes3D();
    const spatial = this.getSpatialPoint(id);
    if ((!nodes[id] && !spatial) || !validPointLabel(next) || nodes[next] || this.getSpatialPoint(next)) return false;
    this.pushHistorySnapshot();
    if (spatial) spatial.label = next;
    else {
      this.pointIds.set(next, this.pointIds.get(id));
      this.pointIds.delete(id);
    }
    const replace = key => key === id ? next : key;
    const remap = data => {
      if (data.baseVertices?.[id]) { data.baseVertices[next] = {...data.baseVertices[id],label:next,desc:'Điểm '+next};delete data.baseVertices[id]; }
      for (const p of [...(data.derivedMidpoints || []),...(data.customPoints || [])]) { p.id=replace(p.id);p.p1=replace(p.p1);p.p2=replace(p.p2); }
      for (const line of [...(data.baseEdges || []),...(data.userSegments || []),...(data.initialSegments || []),...(data.demoSegments || [])]) { line.u=replace(line.u);line.v=replace(line.v); }
      for (const face of data.faces || []) face.nodes=face.nodes.map(replace);
      for (const key of ['hiddenPointIds','lockedPointIds','initialFocused','demoFocused']) if (data[key]) data[key]=data[key].map(replace);
    };
    remap(this);
    const preset = JSON.parse(JSON.stringify(this.currentPresetDefinition || this.presets[this.currentPresetKey]));remap(preset);this.currentPresetDefinition=preset;
    this.focusedNodes = new Set([...this.focusedNodes].map(replace));this.activeAnchorNode=replace(this.activeAnchorNode);
    return next;
  }

  setPointHidden(id, hidden) {
    const spatial = this.getSpatialPoint(id);
    if (!spatial && !this.computeAllNodes3D()[id]) return false;
    this.pushHistorySnapshot();
    const ids = new Set(this.hiddenPointIds || []);
    hidden ? ids.add(id) : ids.delete(id);
    this.hiddenPointIds = [...ids];
    if (spatial) spatial.hidden = hidden;
    if (!hidden && this.derivedMidpoints.some(p => p.id === id)) this.showPresetMidpoints = true;
    return true;
  }

  deletePoint(id) {
    const spatial = this.getSpatialPoint(id);
    if (!spatial && !this.computeAllNodes3D()[id]) return null;
    if (this.isPointLocked(id)) return { blocked: true, locked: [id] };
    if (this.isStructuralPoint(id)) { this.setPointHidden(id, true); return { hidden: true, removed: [id] }; }
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of [...this.derivedMidpoints, ...this.customPoints]) {
        if (!removed.has(p.id) && (removed.has(p.p1) || removed.has(p.p2))) { removed.add(p.id); changed = true; }
      }
    }
    const locked = [...removed].filter(key => this.isPointLocked(key));
    if (locked.length) return { blocked: true, locked };
    const keys = new Set([...removed].map(label => this.pointKey(label)));
    if (this.spatialConstruction.linears.some(l => l.points.some(key => keys.has(key))) ||
        this.spatialConstruction.planes.some(p => p.points.some(key => keys.has(key))) ||
        this.spatialConstruction.points.some(p => p.definition.points?.some(key => keys.has(key)))) {
      return { blocked: true, reason: 'Hãy xóa các đối tượng dựng phụ thuộc vào điểm này trước.' };
    }
    this.pushHistorySnapshot();
    this.derivedMidpoints = this.derivedMidpoints.filter(p => !removed.has(p.id));
    this.customPoints = this.customPoints.filter(p => !removed.has(p.id));
    if (spatial) this.spatialConstruction.points = this.spatialConstruction.points.filter(p => p !== spatial);
    for (const key of removed) delete this.baseVertices[key];
    this.userSegments = this.userSegments.filter(s => !removed.has(s.u) && !removed.has(s.v));
    this.baseEdges = this.baseEdges.filter(s => !removed.has(s.u) && !removed.has(s.v));
    this.hiddenPointIds = (this.hiddenPointIds || []).filter(key => !removed.has(key));
    removed.forEach(key => this.focusedNodes.delete(key));
    if (removed.has(this.activeAnchorNode)) this.activeAnchorNode = null;
    return { hidden: false, removed: [...removed] };
  }

  coveringBaseEdge(u, v, nodes = this.computeAllNodes3D()) {
    const a = nodes[u], b = nodes[v];
    if (!a || !b) return null;
    return this.baseEdges.find(edge => {
      if (edge.hidden) return false;
      const origin = nodes[edge.u], end = nodes[edge.v];
      if (!origin || !end) return false;
      const direction = Vec3.sub(end, origin);
      const length = Vec3.len(direction);
      if (!(length > 1e-9)) return false;
      const onSegment = point => {
        const delta = Vec3.sub(point, origin), parameter = Vec3.dot(delta, direction) / (length * length);
        return parameter >= -1e-7 && parameter <= 1 + 1e-7 &&
          Vec3.len(Vec3.cross(delta, direction)) <= 1e-7 * Math.max(1, length) * length;
      };
      return onSegment(a) && onSegment(b);
    }) ?? null;
  }

  connectSegment(u, v, style = 'AUTO') {
    const nodes = this.computeAllNodes3D();
    if (!nodes[u] || !nodes[v] || u === v || this.linearRefs().some(s => s.type !== 'BASE' && s.kind === 'segment' && sameEnds(s, { u, v }))) return false;
    this.pushHistorySnapshot();
    if (this.getSpatialPoint(u) || this.getSpatialPoint(v)) {
      this.spatialConstruction.linears.push({ id: this.spatialId('line'), kind: 'segment',
        points: [this.pointKey(u), this.pointKey(v)], style: ['SOLID','DASHED'].includes(style) ? style : 'AUTO' });
    } else this.userSegments.push({ u, v, style: ['SOLID','DASHED'].includes(style)?style:'AUTO' });
    this.focusedNodes.add(u); this.focusedNodes.add(v);
    return true;
  }

  connectExtendedLinear(u, v, kind, style = 'AUTO') {
    if (kind !== 'ray' && kind !== 'line') return null;
    const nodes = this.computeAllNodes3D();
    if (!nodes[u] || !nodes[v] || Vec3.dist(nodes[u], nodes[v]) <= 1e-8) return null;
    const endpoints = [this.pointKey(u), this.pointKey(v)];
    const existing = this.spatialConstruction.linears.find(line => !line.constructionOnly && line.kind === kind &&
      (line.points[0] === endpoints[0] && line.points[1] === endpoints[1] ||
        kind === 'line' && line.points[0] === endpoints[1] && line.points[1] === endpoints[0]));
    if (existing) return { ref: this.spatialLinearRef(existing.id), changed: false };
    this.pushHistorySnapshot();
    const line = { id: this.spatialId('line'), kind, points: endpoints,
      style: ['SOLID', 'DASHED'].includes(style) ? style : 'AUTO' };
    this.spatialConstruction.linears.push(line);
    return { ref: this.spatialLinearRef(line.id), changed: true };
  }

  setSpatialStyle(id, style) {
    const line = this.spatialConstruction.linears.find(l => l.id === id);
    if (!line || !['AUTO','SOLID','DASHED'].includes(style) || (line.style ?? 'AUTO') === style) return false;
    this.pushHistorySnapshot('style');
    line.style = style;
    return true;
  }

  deleteSpatialLinear(id) {
    if (!this.spatialConstruction.linears.some(l => l.id === id)) return false;
    if (this.spatialConstruction.points.some(({definition:d}) => d.linear === id || d.linears?.includes(id))) return false;
    this.pushHistorySnapshot();
    this.spatialConstruction.linears = this.spatialConstruction.linears.filter(l => l.id !== id);
    return true;
  }

  setSegmentStyle(type, u, v, style) {
    if(!['AUTO','SOLID','DASHED'].includes(style))return false;
    const list=type==='BASE'?this.baseEdges:this.userSegments,key=type==='BASE'?'forceStyle':'style';
    const segment=list.find(e=>(e.u===u&&e.v===v)||(e.u===v&&e.v===u));
    if(!segment||(segment[key]||'AUTO')===style)return false;
    this.pushHistorySnapshot('style');segment[key]=style;return true;
  }

  deleteSegment(type, u, v) {
    const list = type === 'USER' ? this.userSegments : this.baseEdges;
    const index = list.findIndex(s => (s.u === u && s.v === v) || (s.u === v && s.v === u));
    if (index < 0) return false;
    this.pushHistorySnapshot();
    if (type === 'USER') list.splice(index, 1); else list[index].hidden = true;
    return true;
  }

  showBaseEdge(u, v) {
    const edge = this.baseEdges.find(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
    if (!edge?.hidden) return false;
    this.pushHistorySnapshot(); edge.hidden = false; return true;
  }

  addOrToggleUserSegment(u, v) {
    const nodes = this.computeAllNodes3D();
    if (!nodes[u] || !nodes[v] || u === v) return;
    this.pushHistorySnapshot();
    const existsIdx = this.userSegments.findIndex(
      (seg) => (seg.u === u && seg.v === v) || (seg.u === v && seg.v === u)
    );
    if (existsIdx === -1) {
      this.userSegments.push({ u, v, style: "AUTO" });
    } else {
      this.userSegments.splice(existsIdx, 1);
    }
    this.focusedNodes.add(u);
    this.focusedNodes.add(v);
  }

  cycleSegmentDashStyle(type, u, v) {
    this.pushHistorySnapshot('style');
    if (type === "USER") {
      const seg = this.userSegments.find(
        (s) => (s.u === u && s.v === v) || (s.u === v && s.v === u)
      );
      if (seg) {
        const order = ["AUTO", "SOLID", "DASHED"];
        const nextIdx = (order.indexOf(seg.style || "AUTO") + 1) % order.length;
        seg.style = order[nextIdx];
        return seg.style;
      }
    } else if (type === "BASE") {
      const edge = this.baseEdges.find(
        (e) => (e.u === u && e.v === v) || (e.u === v && e.v === u)
      );
      if (edge) {
        const order = ["AUTO", "SOLID", "DASHED"];
        const nextIdx = (order.indexOf(edge.forceStyle || "AUTO") + 1) % order.length;
        edge.forceStyle = order[nextIdx];
        return edge.forceStyle;
      }
    }
    return "AUTO";
  }

  clearUserSegments() {
    this.pushHistorySnapshot();
    this.userSegments = [];
    this.focusedNodes.clear();
    this.activeAnchorNode = null;
  }

  loadVideoDemoCrossSection() {
    this.pushHistorySnapshot();
    this.showPresetMidpoints = true;
    const preset = this.currentPresetDefinition || this.presets[this.currentPresetKey] || this.presets.S_ABCD;
    const existing = new Set(Object.keys(this.computeAllNodes3D()));
    for (const point of preset.derivedMidpoints || []) if (!existing.has(point.id)) this.derivedMidpoints.push(JSON.parse(JSON.stringify(point)));
    const demoIds = new Set((preset.demoSegments || []).flatMap(s => [s.u, s.v]));
    this.hiddenPointIds = this.hiddenPointIds.filter(id => !demoIds.has(id));
    this.userSegments = JSON.parse(JSON.stringify(preset.demoSegments || []));
    this.focusedNodes = new Set(preset.demoFocused || []);
    this.activeAnchorNode = null;
    const first = this.userSegments.slice(0,3).map(edge=>edge.u);
    const plane = this.createPlane(first,false);
    if(plane)this.createSection(plane.id,false);
  }
}
