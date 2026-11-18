import { Vec3 } from './geometry-math.mjs';

const { add, sub, scale, dot, cross } = Vec3;
const length = p => Math.hypot(p.x,p.y,p.z);
const unit = p => {
  const n = length(p);
  return n > 0 && Number.isFinite(n) ? {x:p.x/n,y:p.y/n,z:p.z/n} : null;
};
const finitePoint = p => p && [p.x,p.y,p.z].every(Number.isFinite);
const result = (status, points = [], extra = {}) => ({ status, points, ...extra });

export function toleranceFor(points) {
  if (!points.length) return 1e-9;
  const a = points[0];
  return Math.max(Number.MIN_VALUE, 1e-9 * Math.max(...points.map(p => length(sub(p,a)))),
    32*Number.EPSILON * Math.max(...points.map(p => Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)))));
}

export function planeThrough(a,b,c) {
  if (![a,b,c].every(finitePoint)) return null;
  const u = sub(b,a), v = sub(c,a), normal = unit(cross(u,v));
  if (!normal || length(cross(u,v)) <= 1e-9 * length(u) * length(v)) return null;
  return { origin:a, normal };
}

export function intersectPlanes(a,b) {
  if (!finitePoint(a?.origin) || !finitePoint(b?.origin)) return result('degenerate');
  const n = a.normal && unit(a.normal), m = b.normal && unit(b.normal);
  if (!n || !m) return result('degenerate');
  const d = cross(n,m), sine = length(d), delta = sub(b.origin,a.origin);
  const offset = dot(m,delta);
  if (!Number.isFinite(offset)) return result('ill-conditioned');
  if (sine <= 32*Number.EPSILON) {
    const roundoff = 64*Number.EPSILON * length(delta);
    return result(Math.abs(offset) <= roundoff ? 'coincident' : 'parallel');
  }
  if (sine < 1e-7) return result('ill-conditioned');
  const direction = scale(d,1/sine);
  const origin = add(a.origin,scale(cross(direction,n),offset/sine));
  return finitePoint(origin) ? result('line',[],{ origin,direction,kind:'line' }) : result('ill-conditioned');
}

function hull(points, normal, epsilon) {
  const distinct = [];
  for (const p of points) if (!distinct.some(q => length(sub(p,q)) <= epsilon)) distinct.push(p);
  if (distinct.length < 3) return distinct;
  const a = distinct[0], u = unit(cross(normal,Math.abs(normal.x) < .8 ? {x:1,y:0,z:0} : {x:0,y:1,z:0}));
  const v = cross(normal,u);
  const items = distinct.map(point => ({ point,x:dot(sub(point,a),u),y:dot(sub(point,a),v) }))
    .sort((p,q)=>p.x-q.x || p.y-q.y);
  const turn = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const chain = sequence => {
    const stack = [];
    for (const p of sequence) {
      while (stack.length >= 2) {
        const b=stack.at(-1), a=stack.at(-2);
        if (turn(a,b,p) > epsilon * Math.hypot(b.x-a.x,b.y-a.y)) break;
        stack.pop();
      }
      stack.push(p);
    }
    return stack.slice(0,-1);
  };
  return [...chain(items),...chain([...items].reverse())].map(p=>p.point);
}

export function planarArea(points) {
  if (points.length < 3) return 0;
  const origin=points[0];
  let sum={x:0,y:0,z:0};
  for(let i=1;i+1<points.length;i++) sum=add(sum,cross(sub(points[i],origin),sub(points[i+1],origin)));
  return length(sum)/2;
}

function facePlane(points) {
  for (let i=1;i+1<points.length;i++) {
    const plane=planeThrough(points[0],points[i],points[i+1]);
    if (plane) return plane;
  }
  return null;
}

function faceBoundary(points) {
  if(!Array.isArray(points)||points.length<3||!points.every(finitePoint))return null;
  const plane=facePlane(points), eps=toleranceFor(points);
  if (!plane || points.some(p=>Math.abs(dot(plane.normal,sub(p,plane.origin)))>eps)) return null;
  const center=points.reduce((s,p)=>add(s,scale(p,1/points.length)),{x:0,y:0,z:0});
  const sides=points.map((p,i)=>{
    let normal=unit(cross(plane.normal,sub(points[(i+1)%points.length],p)));
    if (!normal) return null;
    if (dot(normal,sub(center,p))<0) normal=scale(normal,-1);
    return { origin:p,normal };
  });
  if(sides.some(side=>!side || points.some(p=>dot(side.normal,sub(p,side.origin)) < -eps))) return null;
  return {plane,sides,eps};
}

export function sectionConvexPolyhedron(solid, plane, getPoint) {
  const normal=plane?.normal && unit(plane.normal);
  if (!normal || !finitePoint(plane.origin)) return result('degenerate');
  const vertices=solid.vertices.map(getPoint);
  if (!vertices.every(finitePoint)) return result('degenerate');
  const eps=toleranceFor(vertices);
  const edges=new Map(), usedVertices=new Set(), seenFaces=new Set();
  const onFaces=[];
  for(const face of solid.faces){
    const faceKey=JSON.stringify([...face.points].sort());
    if(seenFaces.has(faceKey))return result('unsupported',[],{reason:'open-topology'});
    seenFaces.add(faceKey);
    face.points.forEach(id=>usedVertices.add(id));
    const boundary=face.points.map(getPoint), data=faceBoundary(boundary);
    if (!data) return result('unsupported',[],{reason:'nonplanar-or-concave-face'});
    const offsets=vertices.map(p=>dot(data.plane.normal,sub(p,data.plane.origin)));
    if (offsets.some(x=>x>eps) && offsets.some(x=>x<-eps)) return result('unsupported',[],{reason:'non-convex-solid'});
    if (!offsets.some(x=>Math.abs(x)>eps)) return result('unsupported',[],{reason:'degenerate-solid'});
    if (boundary.every(p=>Math.abs(dot(normal,sub(p,plane.origin)))<=eps)) onFaces.push(face.id);
    for(let i=0;i<face.points.length;i++){
      const ids=[face.points[i],face.points[(i+1)%face.points.length]].sort();
      const key=JSON.stringify(ids), entry=edges.get(key);
      if(entry)entry.count++; else edges.set(key,{ids,count:1});
    }
  }
  if (solid.faces.length<4||usedVertices.size!==solid.vertices.length||!edges.size ||
      [...edges.values()].some(e=>e.count!==2)) return result('unsupported',[],{reason:'open-topology'});
  const signed=new Map(solid.vertices.map((id,i)=>[id,dot(normal,sub(vertices[i],plane.origin))]));
  const hits=[];
  for(const {ids:[a,b]} of edges.values()){
    const u=signed.get(a),v=signed.get(b), p=getPoint(a),q=getPoint(b);
    if(Math.abs(u)<=eps)hits.push(p);
    if(Math.abs(v)<=eps)hits.push(q);
    if((u>eps && v<-eps)||(v>eps && u<-eps)) hits.push(add(p,scale(sub(q,p),u/(u-v))));
  }
  if(!hits.every(finitePoint))return result('degenerate');
  const points=hull(hits,normal,eps), area=planarArea(points);
  if(!Number.isFinite(area))return result('degenerate');
  return result(onFaces.length ? 'coincident-face' : ['none','point','segment'][points.length] ?? 'polygon',
    points,{area,faces:onFaces});
}

// Convex finite faces use their own half-spaces. Infinite plane intersection is independent.
export function intersectFiniteFaces(a,b) {
  const x=faceBoundary(a),y=faceBoundary(b);
  if(!x||!y)return result('unsupported');
  const infinite=intersectPlanes(x.plane,y.plane), eps=Math.max(x.eps,y.eps);
  if(infinite.status==='line'){
    let lo=-Infinity,hi=Infinity;
    for(const side of [...x.sides,...y.sides]){
      const offset=dot(side.normal,sub(infinite.origin,side.origin)), rate=dot(side.normal,infinite.direction);
      if(Math.abs(rate)<1e-12){if(offset<-eps)return result('none');continue;}
      const t=-offset/rate;
      if(rate>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo-eps)return result('none');
    const points=[lo,hi].map(t=>add(infinite.origin,scale(infinite.direction,t)));
    return hi-lo<=eps ? result('point',[points[0]]) : result('segment',points);
  }
  if(infinite.status!=='coincident')return result(infinite.status==='parallel'?'none':infinite.status);
  let overlap=a;
  for(const side of y.sides){
    const next=[];
    for(let i=0;i<overlap.length;i++){
      const p=overlap[i],q=overlap[(i+1)%overlap.length], u=dot(side.normal,sub(p,side.origin)),v=dot(side.normal,sub(q,side.origin));
      if(u>=-eps)next.push(p);
      if((u>=-eps)!==(v>=-eps))next.push(add(p,scale(sub(q,p),Math.max(0,Math.min(1,u/(u-v))))));
    }
    overlap=next;
  }
  const points=hull(overlap,x.plane.normal,eps);
  return result(['none','point','segment'][points.length]??'polygon',points);
}
