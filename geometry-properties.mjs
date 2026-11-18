import { Vec3 } from './geometry-math.mjs';
import { resolveModel } from './geometry-model.mjs';
import { toleranceFor } from './geometry-sections.mjs';

const { sub, dot, cross } = Vec3;
const norm = v => Math.hypot(v.x,v.y,v.z);
const textRatio = t => t === .5 ? '1/2' : t === .25 ? '1/4' : t === .125 ? '1/8' : String(Number(t.toPrecision(8)));

export function measureLinearRelation(a,b) {
  if (!a?.direction || !b?.direction) return null;
  const u = norm(a.direction), v = norm(b.direction);
  if (!u || !v) return null;
  const first = Vec3.scale(a.direction,1/u), second = Vec3.scale(b.direction,1/v);
  if (norm(cross(first,second)) < 1e-8) return 'parallel';
  if (Math.abs(dot(first,second)) < 1e-8) return 'perpendicular';
  return null;
}

export function analyzeGeometry(model, resolved = resolveModel(model)) {
  const points = new Map(model.points.map(p=>[p.id,p])), linears=new Map(model.linears.map(l=>[l.id,l]));
  const value=id=>resolved.get(id)?.value;
  const label=id=> points.get(id)?.label ?? (linears.has(id) ? linears.get(id).points.map(p=>points.get(p)?.label).join('') : id);
  const facts=[], sections=[], divisions=new Map();
  const fact=(id,text,subjects,kind,rule,premises=[],details={})=>{
    const f={id,text,subjects:[...new Set(subjects)],provenance:{kind,rule,premises},...details};
    facts.push(f);return f.id;
  };
  for (const p of model.points) {
    const d=p.definition;
    if(!value(p.id))continue;
    const line=d.kind==='onLinear'?linears.get(d.linear):null;
    if(d.kind==='midpoint'||line){
      const endpoints=d.points??line.points,t=d.kind==='midpoint'?.5:d.t;
      const [a,b]=endpoints;
      const id=fact('division:'+p.id,t===.5?label(p.id)+' là trung điểm '+label(a)+label(b)
        :label(p.id)+' thuộc '+label(a)+label(b)+' với t = '+textRatio(t),
        [p.id,a,b,...(line?[line.id]:[])],'construction',t===.5?'midpoint':'division',[],{t});
      divisions.set(p.id,{endpoints,t,fact:id});
      if(t>0&&t<1&&t!==.5)fact('ratio:'+p.id,
        label(a)+label(p.id)+' / '+label(p.id)+label(b)+' = '+textRatio(t/(1-t)),[p.id,a,b],'rule','internal-division-ratio',[id]);
    } else if(d.kind==='onPlane'||d.kind==='intersectionLP'||d.kind==='intersectionLL') {
      const objects=d.linears??[d.linear,d.plane].filter(Boolean);
      fact('incidence:'+p.id,label(p.id)+' thuộc các đối tượng dựng đã chọn',[p.id,...objects],'construction','incidence');
    }
  }
  for (const plane of model.planes) if (value(plane.id)) {
    fact('plane:'+plane.id,'Mặt phẳng đi qua '+plane.points.map(label).join(', '),
      [plane.id,...plane.points],'construction','plane-through-points');
  }
  for (const c of model.constraints) {
    const [a,b]=c.subjects;
    if (['parallel','perpendicular'].includes(c.kind) && measureLinearRelation(value(a),value(b))===c.kind) {
      fact('given:'+c.id,label(a)+(c.kind==='parallel'?' ∥ ':' ⟂ ')+label(b),c.subjects,'given','explicit-constraint',[c.id]);
    }
  }
  for(const line of model.linears){
    if(line.constructionOnly||!value(line.id))continue;
    const [p,q]=line.points,a=divisions.get(p),b=divisions.get(q);
    if(a?.t!==.5||b?.t!==.5)continue;
    const apex=a.endpoints.find(id=>b.endpoints.includes(id));
    if(!apex)continue;
    const x=a.endpoints.find(id=>id!==apex),y=b.endpoints.find(id=>id!==apex);
    if(x===y||!value(x)||!value(y)||!value(apex))continue;
    const u=sub(value(x),value(apex)),v=sub(value(y),value(apex));
    if(norm(cross(u,v))<=1e-9*norm(u)*norm(v))continue;
    fact('midline:'+line.id,label(p)+label(q)+' ∥ '+label(x)+label(y),[line.id,p,q,x,y],
      'rule','triangle-midline',[a.fact,b.fact],{segments:[[p,q],[x,y]]});
  }
  for (const section of model.sections) {
    const geometry=value(section.id), plane=model.planes.find(p=>p.id===section.plane);
    const solid=model.solids.find(s=>s.id===section.solid);
    const view={id:section.id,plane:section.plane,solid:section.solid,
      status:geometry?.status??'undefined',points:geometry?.points??[],area:geometry?.area??0,faces:geometry?.faces??[],
      reason:geometry?.reason??resolved.get(section.id)?.reason};
    const eps=toleranceFor(view.points);
    const candidates=[...new Set([...plane.points,...divisions.keys(),...solid.vertices,...points.keys()])];
    const cornerIds=view.points.map(p=>candidates.find(id=>value(id)&&norm(sub(value(id),p))<=eps)??null);
    const start=cornerIds.indexOf(plane.points[0]), second=cornerIds.indexOf(plane.points[1]);
    if(view.points.length>=3 && start>=0){
      const n=view.points.length,forward=second<0||(second-start+n)%n <= (start-second+n)%n;
      const order=Array.from({length:n},(_,i)=>(start+(forward?i:-i)+n)%n);
      view.points=order.map(i=>view.points[i]);
      view.cornerIds=order.map(i=>cornerIds[i]);
    }else view.cornerIds=cornerIds;
    view.labels=view.cornerIds.map(id=>id?label(id):null);
    sections.push(view);
    if (view.status!=='polygon') continue;
    const deps=plane.points.map(id=>divisions.get(id));
    if(deps.some(d=>!d))continue;
    const apex=deps[0].endpoints.find(id=>deps.every(d=>d.endpoints.includes(id)));
    if(!apex)continue;
    const bases=solid.faces.filter(f=>!f.points.includes(apex));
    if(bases.length!==1)continue;
    const base=bases[0], ring=base.points;
    if(solid.vertices.length!==ring.length+1||solid.faces.length!==ring.length+1||
       !solid.faces.filter(f=>f!==base).every(f=>f.points.length===3&&f.points.includes(apex)))continue;
    const ratioFromApex=d=>d.endpoints[0]===apex?d.t:1-d.t;
    const t=ratioFromApex(deps[0]);
    if(!(t>0&&t<1)||!deps.every(d=>ratioFromApex(d)===t&&d.endpoints.some(id=>ring.includes(id))))continue;
    const members=[section.id,plane.id,apex,...ring,...plane.points];
    const names=ring.map(label), startBase=names.indexOf([...names].sort()[0]);
    const forward=Array.from({length:names.length},(_,i)=>names[(startBase+i)%names.length]).join('');
    const backward=Array.from({length:names.length},(_,i)=>names[(startBase-i+names.length)%names.length]).join('');
    const baseLabel=forward<backward?forward:backward;
    const topology=fact(section.id+':topology',label(apex)+'.'+baseLabel+' có cấu trúc hình chóp',
      [solid.id,apex,...ring],'construction','pyramid-topology');
    const parallel=fact(section.id+':parallel','Mặt phẳng cắt ∥ ('+baseLabel+')',
      members,'rule','pyramid-homothety',[topology,...deps.map(d=>d.fact)],{section:section.id,polygons:[ring]});
    fact(section.id+':area','S(thiết diện) / S(đáy) = '+textRatio(t*t),
      members,'rule','homothety-area',[parallel],{section:section.id,ratio:t*t});
    fact(section.id+':volume','V(chóp nhỏ) / V(chóp) = '+textRatio(t*t*t),
      members,'rule','homothety-volume',[parallel],{section:section.id,ratio:t*t*t});
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const corner=base=>view.cornerIds.find(id=>{
        const d=divisions.get(id);return d?.endpoints.includes(apex)&&d.endpoints.includes(base)&&ratioFromApex(d)===t;
      });
      const p=corner(a),q=corner(b);
      if(!p||!q)continue;
      const sideIndex=view.cornerIds.indexOf(p);
      const along=view.cornerIds[(sideIndex+1)%view.cornerIds.length]===q;
      let [u,v]=along?[p,q]:[q,p], [x,y]=along?[a,b]:[b,a];
      const baseText=[label(x),label(y)].sort().join('');
      fact(section.id+':side:'+i,label(u)+label(v)+' ∥ '+baseText,[section.id,u,v,x,y],
        'rule',t===.5?'triangle-midline':'triangle-homothety',[divisions.get(p).fact,divisions.get(q).fact],
        {section:section.id,segments:[[u,v],[x,y]]});
    }
  }
  return {facts,sections,labels:points};
}
