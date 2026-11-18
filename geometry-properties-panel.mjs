import { measureLinearRelation } from './geometry-properties.mjs';

const states={polygon:'Thiết diện đa giác','coincident-face':'Trùng mặt của khối',point:'Tiếp xúc tại một điểm',
  segment:'Tiếp xúc theo một đoạn',none:'Không cắt khối',unsupported:'Khối lõm, mặt không phẳng hoặc biên khối hở chưa được hỗ trợ',
  undefined:'Mặt phẳng hoặc đối tượng cha không xác định',degenerate:'Đối tượng suy biến'};
const proof={
  'pyramid-homothety':'Ba điểm trên mặt phẳng cắt là ảnh của ba đỉnh đáy qua cùng phép vị tự tâm đỉnh chóp. Vì vậy mặt phẳng ảnh song song với đáy.',
  'homothety-area':'Diện tích biến đổi theo bình phương tỉ số vị tự.',
  'homothety-volume':'Thể tích biến đổi theo lập phương tỉ số vị tự.',
  'triangle-midline':'Đoạn nối hai trung điểm của hai cạnh tam giác song song với cạnh còn lại.',
  'triangle-homothety':'Hai điểm có cùng tỉ số tính từ đỉnh chung nên đoạn nối chúng là ảnh vị tự của cạnh đáy.',
  'internal-division-ratio':'Tham số t cho độ dài từ đầu thứ nhất theo đơn vị độ dài đoạn. Phần còn lại có độ dài 1 − t.',
  'pyramid-topology':'Khối có một đáy và các mặt bên tam giác cùng chung một đỉnh.',
  'explicit-constraint':'Quan hệ được khai báo riêng trong dữ liệu hình học và vẫn phù hợp với cấu hình hiện tại.'
};
const status = value=>({line:'Giao tuyến vô hạn',point:'Một điểm chung',segment:'Một đoạn chung',
  polygon:'Một vùng chung',none:'Không giao',parallel:'Song song',coincident:'Trùng mặt phẳng',
  degenerate:'Không xác định',unsupported:'Mặt không lồi hoặc không hợp lệ','ill-conditioned':'Gần song song'})[value]??value;
const fmt = x=>Number.isFinite(x)?Number(x.toPrecision(6)).toLocaleString('vi-VN'):'—';
function options(select,items,placeholder){
  const previous=select.value;
  select.replaceChildren(new Option(placeholder,''));
  const counts=new Map(), seen=new Map();
  for(const [,label] of items)counts.set(label,(counts.get(label)??0)+1);
  for(const [id,label] of items){
    const index=(seen.get(label)??0)+1;seen.set(label,index);
    select.add(new Option(counts.get(label)>1?label+' · '+index:label,id));
  }
  if(items.some(([id])=>id===previous))select.value=previous;
}
function button(label, action, pressed) {
  const el=document.createElement('button');
  el.type='button';el.textContent=label;
  if(pressed!==undefined)el.setAttribute('aria-pressed',String(pressed));
  el.addEventListener('click',action);return el;
}

export class GeometryPropertiesPanel {
  constructor(app){
    this.app=app;
    this.toggle=document.getElementById('btn-properties-toggle');
    this.root=document.getElementById('properties-panel');
    this.root.innerHTML=`
      <div class="properties-head"><strong>Tính chất</strong><button type="button" data-close aria-label="Đóng bảng chi tiết" title="Đóng bảng chi tiết">×</button></div>
      <section><h3>Đang chọn</h3><p data-selected></p>
        <div class="properties-controls" data-plane-points>
          <select aria-label="Điểm thứ nhất"></select><select aria-label="Điểm thứ hai"></select><select aria-label="Điểm thứ ba"></select>
          <button type="button" data-create-plane>Dựng mặt phẳng</button>
        </div><p data-plane-message role="status"></p>
      </section>
      <section><h3>Thiết diện</h3><div class="properties-controls">
        <select data-cut-plane aria-label="Mặt phẳng cắt"></select><button type="button" data-cut>Cắt khối</button>
        </div><div data-sections></div>
      </section>
      <section><h3>Quan hệ</h3>
        <div class="properties-controls"><select data-first aria-label="Mặt hay mặt phẳng thứ nhất"></select>
        <select data-second aria-label="Mặt hay mặt phẳng thứ hai"></select></div>
        <p data-comparison></p><div data-overlay></div>
        <div data-facts></div><button type="button" data-more>Xem thêm</button>
      </section>
      <section><h3>Giải thích</h3><p data-proof>Chọn một quan hệ để xem căn cứ.</p></section>
      <section><h3>Cần chú ý</h3><p>Đa giác dựng bằng các đoạn đồng phẳng chưa đủ để xác nhận thiết diện. Kết quả ghi “Gần đúng” dựa trên tọa độ của hình hiện tại.</p></section>`;
    this.q=selector=>this.root.querySelector(selector);
    this.toggle.addEventListener('click',()=>this.setOpen(this.root.hidden));
    this.q('[data-close]').addEventListener('click',()=>this.setOpen(false));
    this.q('[data-create-plane]').addEventListener('click',()=>{
      const names=[...this.root.querySelectorAll('[data-plane-points] select')].map(el=>el.value);
      const before=app.scene.geometryRevision, plane=app.scene.createPlane(names);
      this.q('[data-plane-message]').textContent=plane?'Đã chọn mặt phẳng qua '+names.join(', ')+'.'
        :'Chọn ba điểm phân biệt, không thẳng hàng.';
      if(!plane)return;
      this.activePlaneId=plane.id;
      app.applyEditorResult({selected:null},false);
      if(before!==app.scene.geometryRevision)app.scheduleDraft();
      this.update(true);this.q('[data-cut-plane]').value=plane.id;
    });
    this.q('[data-cut]').addEventListener('click',()=>{
      const before=app.scene.geometryRevision, section=app.scene.createSection(this.q('[data-cut-plane]').value);
      if(!section){this.q('[data-plane-message]').textContent='Chọn mặt phẳng cắt trước.';return;}
      this.sectionId=section.id;this.factId=null;this.activePlaneId=null;
      app.applyEditorResult({selected:null},false);
      if(before!==app.scene.geometryRevision)app.scheduleDraft();
      this.update(true);
    });
    for(const key of ['first','second'])this.q('[data-'+key+']').addEventListener('change',()=>{
      this.relationOverlay=null;this.update(true);
    });
    this.q('[data-more]').addEventListener('click',()=>{this.more=!this.more;this.update(true);});
  }

  setOpen(open) {
    const changed = this.root.hidden === open;
    this.root.hidden=!open;
    this.toggle.setAttribute('aria-expanded',String(open));
    if(changed){
      this.app.resizeCanvas();
      this.app.notebook?.frame.layout();
    }
    if(open){
      this.update(true);
      this.app.inspector?.show(this.app.inspector.active);
    }else this.toggle.focus({preventScroll:true});
  }

  update(force=false) {
    if(this.root.hidden)return;
    const {app}=this, {scene}=app, selected=app.editor.selected, info=scene.properties();
    const key=[scene.geometryRevision,app.editor.selectionRevision,app.pendingIntersection?.second?.linearId,
      app.pendingIntersection?.second?.u, app.pendingIntersection?.second?.v].join('|');
    if(!force&&this.key===key)return;
    this.key=key;
    const planeOptions=scene.sectionPlaneOptions();
    const names=Object.keys(app.worldNodes()).map(id=>[id,id]);
    for(const el of this.root.querySelectorAll('[data-plane-points] select'))options(el,names,'Chọn điểm');
    options(this.q('[data-cut-plane]'),planeOptions.filter(o=>o.plane).map(o=>[o.id,o.label]),'Chọn mặt phẳng cắt');
    for(const id of ['first','second'])options(this.q('[data-'+id+']'),planeOptions.map(o=>[o.id,o.label]),'Chọn mặt hoặc mặt phẳng');
    const active=info.sections.find(s=>s.id===this.sectionId)??info.sections.at(-1);
    this.sectionId=active?.id;
    this.q('[data-selected]').textContent=selected?.kind==='POINT'?'Điểm '+selected.id
      :selected?.kind==='SEGMENT'?app.linearLabel({...selected,kind:scene.linearGeometry(selected)?.kind})
        :planeOptions.find(o=>o.id===this.activePlaneId)?.label??(active?'Mặt phẳng cắt của thiết diện đang xem':'Chưa chọn đối tượng.');
    const list=this.q('[data-sections]');list.replaceChildren();
    if(!info.sections.length)list.textContent='Chưa có mặt phẳng cắt khối.';
    for(const s of info.sections){
      const name=s.labels.length&&s.labels.every(Boolean)?s.labels.join('–'):(s.points.length?s.points.length+' đỉnh':'');
      const reason={ 'non-convex-solid':'khối không lồi','nonplanar-or-concave-face':'mặt không phẳng hoặc không lồi',
        'open-topology':'biên khối hở','degenerate-solid':'khối suy biến' }[s.reason];
      const text=[states[s.status]??s.status,reason,name,s.area>0?'S = '+fmt(s.area):''].filter(Boolean).join(' · ');
      list.append(button(text,()=>{this.sectionId=s.id;this.activePlaneId=null;this.factId=null;this.relationOverlay=null;
        app.applyEditorResult({selected:null},false);this.update(true);},s.id===active?.id));
    }
    const comparison=scene.comparePlanes(this.q('[data-first]').value,this.q('[data-second]').value);
    let comparisonText=comparison?'Gần đúng (tọa độ) · Hai mặt phẳng: '+status(comparison.infinite.status)+
      (comparison.finite?' · Hai mặt hữu hạn: '+status(comparison.finite.status):''):'';
    const pending=app.pendingIntersection;
    this.measuredLines=null;
    if(pending&&selected?.kind==='SEGMENT'&&!pending.second.faceId&&!pending.second.planeId){
      const lines=[scene.linearGeometry(selected),scene.linearGeometry(pending.second)];
      const relation=measureLinearRelation(...lines);
      if(relation){
        this.measuredLines=lines;
        comparisonText+=(comparisonText?' · ':'')+'Gần đúng · hai phương '+(relation==='parallel'?'song song':'vuông góc');
      }
    }
    this.q('[data-comparison]').textContent=comparisonText;
    this.comparison=comparison;
    const overlay=this.q('[data-overlay]');overlay.replaceChildren();
    if(comparison?.infinite.status==='line')overlay.append(button('Tô giao tuyến',()=>{
      this.relationOverlay=this.relationOverlay==='infinite'?null:'infinite';this.activeFact=null;this.factId=null;this.update(true);
    },this.relationOverlay==='infinite'));
    if(comparison?.finite?.points.length)overlay.append(button('Tô phần chung hai mặt',()=>{
      this.relationOverlay=this.relationOverlay==='finite'?null:'finite';this.activeFact=null;this.factId=null;this.update(true);
    },this.relationOverlay==='finite'));
    if(this.measuredLines)overlay.append(button('Tô hai đường đang đo',()=>{
      this.relationOverlay=this.relationOverlay==='measured'?null:'measured';this.factId=null;this.update(true);
    },this.relationOverlay==='measured'));
    const subject=selected?.kind==='POINT'?scene.pointKey(selected.id):selected?.linearId??(!selected?this.activePlaneId:null);
    const endpoints=selected?.kind==='SEGMENT'?[scene.pointKey(selected.u),scene.pointKey(selected.v)]:[];
    const relevant=info.facts.filter(f=>subject?f.subjects.includes(subject):endpoints.length?
      endpoints.every(id=>f.subjects.includes(id)):active?f.section===active.id||f.subjects.includes(active.plane):false);
    const visible=this.more?info.facts:[...relevant].slice(0,12);
    const factList=this.q('[data-facts]');factList.replaceChildren();
    for(const f of visible){
      const badge={construction:'Cách dựng',rule:'Suy ra',given:'Khai báo'}[f.provenance.kind];
      factList.append(button((badge?badge+' · ':'')+f.text,()=>{
        this.factId=this.factId===f.id?null:f.id;this.relationOverlay=null;this.update(true);
      },this.factId===f.id));
    }
    if(!visible.length)factList.textContent='Chưa có quan hệ phù hợp với lựa chọn.';
    this.q('[data-more]').hidden=!this.more&&visible.length===info.facts.length;
    this.q('[data-more]').textContent=this.more?'Thu gọn':'Xem thêm';
    this.activeFact=info.facts.find(f=>f.id===this.factId);
    const f=this.activeFact;
    const premises=f?.provenance.premises.map(id=>info.facts.find(item=>item.id===id)?.text).filter(Boolean)??[];
    this.q('[data-proof]').textContent=f?
      [proof[f.provenance.rule]??f.text,...premises].join(' · '):'Chọn một quan hệ để xem căn cứ.';
  }
}
