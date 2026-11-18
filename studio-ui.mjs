export const PAPER_PREFERENCES = 'geometry-studio.paper-ui.v1';

const paperBox = { x: 0, y: 0, width: 700, height: 500 };
const standardBox = { x: 40, y: 76, width: 650, height: 382 };
const defaults = { width: 292, height: 260, x: null, y: null, docked: true, locked: false, zoom: 1, fit: false };
const paperKeySteps = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function studioTitle(title) {
  return typeof title === 'string' ? title.replace(/\s*\((?:Video Mẫu|Video Gốc)\)\s*$/iu, '') : title;
}

export function paperSize(width, height, bounds, ratio, axis = 'width') {
  const minWidth = Math.min(204, bounds.width);
  const minHeight = Math.min(168, bounds.height);
  if (!ratio) return { width: clamp(width, minWidth, bounds.width), height: clamp(height, minHeight, bounds.height) };
  const maxWidth = Math.min(bounds.width, bounds.height * ratio);
  const lowerWidth = Math.min(maxWidth, Math.max(minWidth, minHeight * ratio));
  const nextWidth = clamp(axis === 'width' ? width : height * ratio, lowerWidth, maxWidth);
  return { width: nextWidth, height: nextWidth / ratio };
}

export function paperViewBox(zoom, fit) {
  const box = fit ? paperBox : standardBox;
  const width = box.width / zoom;
  const height = box.height / zoom;
  return [box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height].join(' ');
}

export function paperFrameLayout(prefs, bounds, inspector, ratio, axis) {
  const alongside = prefs.docked && inspector && bounds.right - bounds.left >= 610 && inspector.left - bounds.left >= 214;
  const right = alongside ? Math.min(bounds.right, inspector.left - 10) : bounds.right;
  // Stack the two panels on mobile. Keep the selection controls below both.
  const top = prefs.docked && inspector && !alongside
    ? clamp(inspector.bottom + 8, bounds.top, bounds.bottom - 132) : bounds.top;
  const limits = { width: Math.max(1, right - bounds.left), height: Math.max(1, bounds.bottom - top) };
  const size = paperSize(prefs.width, prefs.height, limits, ratio, axis);
  const left = prefs.docked ? right - size.width : clamp(prefs.x ?? right - size.width, bounds.left, right - size.width);
  const y = prefs.docked ? top : clamp(prefs.y ?? top, top, bounds.bottom - size.height);
  return { ...size, left, top: y };
}

function loadPreferences(storage) {
  try {
    const stored = JSON.parse(storage().getItem(PAPER_PREFERENCES));
    if (!stored || typeof stored !== 'object') return { ...defaults };
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
      const saved = stored[key];
      const valid = typeof value === 'boolean' ? typeof saved === 'boolean' : Number.isFinite(saved);
      return [key, valid ? saved : value];
    }));
  } catch { return { ...defaults }; }
}

const icons = {
  select: '<path d="m5 3 15 10-8 1-3 7z"/>',
  connect: '<path d="m7 17 10-10"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="5" r="2.5"/>',
  point: '<circle cx="8" cy="16" r="3"/><path d="M17 3v8m-4-4h8"/>',
  move: '<path d="M12 2v20M2 12h20m-13-7 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
  midpoint: '<path d="M3 12h6m6 0h6M3 8v8m18-8v8"/><circle cx="12" cy="12" r="3"/>',
  erase: '<path d="m3 14 10-10a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-9 9H8zm5-5 8 8m-5 3h10"/>',
  line: '<path d="M3 12h4m3 0h4m3 0h4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  paper: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
  inspector: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16m3-11h1m-1 3h1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 3 3-1 2 3 3-2 3 1 3-3-1-3 1-3-3-2-1-3z"/>',
  resize: '<path d="m6 19 13-13m-7 13 7-7m-1 7 1-1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};

export function studioIcon(name) {
  return '<svg class="studio-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + icons[name] + '</svg>';
}

export class PaperFrame {
  constructor({ panel, svg, toggle, close, storage = () => localStorage, onOpen }) {
    Object.assign(this, { panel, svg, toggle, storage, onOpen });
    this.prefs = loadPreferences(storage);
    this.prefs.zoom = clamp(this.prefs.zoom, .5, 3);
    this.head = panel.querySelector('.notebook-heading');
    this.handle = panel.querySelector('[data-paper-resize]');
    this.controls = Object.fromEntries([...panel.querySelectorAll('[data-paper-action]')].map(button => [button.dataset.paperAction, button]));
    this.controls.dock.addEventListener('click', () => {
      if (this.prefs.docked) {
        const { left, top } = panel.getBoundingClientRect();
        Object.assign(this.prefs, { x: left, y: top });
      }
      this.prefs.docked = !this.prefs.docked;
      this.commit();
    });
    this.controls.lock.addEventListener('click', () => {
      this.prefs.locked = !this.prefs.locked;
      this.commit();
    });
    this.controls.reset.addEventListener('click', () => {
      Object.assign(this.prefs, { width: defaults.width, height: defaults.height });
      this.commit();
    });
    this.controls.fit.addEventListener('click', () => {
      Object.assign(this.prefs, { fit: true, zoom: 1 });
      this.commit();
    });
    for (const [control, delta] of [['in', .25], ['out', -.25]]) this.controls[control].addEventListener('click', () => {
      this.prefs.zoom = clamp(this.prefs.zoom + delta, .5, 3);
      this.commit();
    });
    toggle.addEventListener('click', () => this.setOpen(panel.hidden));
    close.addEventListener('click', () => { this.setOpen(false); toggle.focus(); });
    this.bindGesture(this.handle, 'resize');
    this.bindGesture(this.head, 'move');
    this.handle.addEventListener('keydown', event => this.resizeWithKeys(event));
    this.head.addEventListener('keydown', event => {
      if (event.target !== this.head || this.prefs.docked) return;
      const step = paperKeySteps[event.key];
      if (!step) return;
      event.preventDefault();
      event.stopPropagation();
      const { left, top } = panel.getBoundingClientRect();
      Object.assign(this.prefs, { x: left + step[0], y: top + step[1] });
      this.commit();
    });
    for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'wheel']) {
      panel.addEventListener(type, event => event.stopPropagation());
    }
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (this.gesture) this.finishGesture(false);
      else { this.setOpen(false); toggle.focus(); }
      event.preventDefault();
      event.stopPropagation();
    });
    const inspector = document.getElementById('properties-panel');
    this.observer = new ResizeObserver(entries => {
      if (entries.some(entry => entry.target === inspector)) this.layout();
      else this.refreshHitTransform();
    });
    this.observer.observe(svg);
    this.observer.observe(inspector);
    const updateLayout = () => this.layout();
    window.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('scroll', updateLayout);
    window.addEventListener('blur', () => this.finishGesture(false));
    this.update();
  }

  setOpen(open) {
    if (!open) this.finishGesture(false);
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('notebook-open', open);
    this.layout();
    if (open) this.onOpen?.();
  }

  bounds() {
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + (innerWidth <= 760 ? 64 : 88);
    const top = (viewport?.offsetTop ?? 0) + 92;
    const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth) - 10;
    const compact = innerWidth <= 760;
    const cameraOptionsOpen = document.body.classList.contains('studio-camera-options-open');
    const bottomReserve = compact ? (cameraOptionsOpen ? 260 : 155) : 109;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - bottomReserve;
    return { left: Math.min(left, right - 150), top: Math.min(top, bottom - 150), right, bottom };
  }

  layout(ratio, axis) {
    if (this.panel.hidden) return;
    const bounds = this.bounds();
    const inspector = document.querySelector('#properties-panel:not([hidden])');
    const rect = inspector?.getBoundingClientRect();
    const inspectorBox = rect?.width ? rect : null;
    const box = paperFrameLayout(this.prefs, bounds, inspectorBox, ratio, axis);
    for (const [key, value] of Object.entries(box)) this.panel.style[key] = value + 'px';
    this.refreshHitTransform();
  }

  update() {
    this.panel.dataset.docked = String(this.prefs.docked);
    this.head.tabIndex = this.prefs.docked ? -1 : 0;
    this.head.title = this.prefs.docked ? '' : 'Kéo tiêu đề hoặc dùng phím mũi tên để di chuyển khung';
    this.controls.dock.textContent = this.prefs.docked ? 'Tách khung' : 'Ghim khung';
    this.controls.lock.setAttribute('aria-pressed', String(this.prefs.locked));
    this.controls.out.disabled = this.prefs.zoom <= .5;
    this.controls.in.disabled = this.prefs.zoom >= 3;
    this.panel.querySelector('[data-paper-zoom]').textContent = Math.round(this.prefs.zoom * 100) + '%';
    this.svg.setAttribute('viewBox', paperViewBox(this.prefs.zoom, this.prefs.fit));
    this.layout();
  }

  commit() {
    this.update();
    try { this.storage().setItem(PAPER_PREFERENCES, JSON.stringify(this.prefs)); } catch { /* session preferences still apply */ }
  }

  refreshHitTransform() {
    const matrix = this.svg.getScreenCTM();
    this.clientToPaper = matrix?.is2D ? matrix.inverse() : null;
  }

  projectPointer(event) {
    this.refreshHitTransform();
    const point = this.clientToPaper?.transformPoint({ x: event.clientX, y: event.clientY });
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  }

  bindGesture(element, kind) {
    element.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || this.gesture) return;
      if (kind === 'move' && (this.prefs.docked || event.target.closest('button'))) return;
      event.preventDefault();
      element.focus({ preventScroll: true });
      const box = this.panel.getBoundingClientRect();
      this.gesture = { kind, element, id: event.pointerId, x: event.clientX, y: event.clientY, box, saved: { ...this.prefs } };
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', event => {
      const task = this.gesture;
      if (!task || event.pointerId !== task.id) return;
      const dx = event.clientX - task.x, dy = event.clientY - task.y;
      if (task.kind === 'move') {
        Object.assign(this.prefs, { x: task.box.left + dx, y: task.box.top + dy });
        this.layout();
      } else {
        const ratio = this.prefs.locked || event.shiftKey ? task.box.width / task.box.height : undefined;
        const axis = Math.abs(dx) > Math.abs(dy) * (ratio || 1) ? 'width' : 'height';
        Object.assign(this.prefs, { width: task.box.width + (this.prefs.docked ? -dx : dx), height: task.box.height + dy });
        this.layout(ratio, axis);
      }
    });
    element.addEventListener('pointerup', event => {
      if (this.gesture?.id === event.pointerId) this.finishGesture(true);
    });
    for (const name of ['pointercancel', 'lostpointercapture']) element.addEventListener(name, event => {
      if (this.gesture?.id === event.pointerId) this.finishGesture(false);
    });
  }

  finishGesture(save) {
    const task = this.gesture;
    if (!task) return;
    this.gesture = null;
    if (task.element.hasPointerCapture(task.id)) task.element.releasePointerCapture(task.id);
    if (!save) {
      this.prefs = task.saved;
      this.layout();
      return;
    }
    const { width, height, left: x, top: y } = this.panel.getBoundingClientRect();
    Object.assign(this.prefs, task.kind === 'resize' ? { width, height } : { x, y });
    this.commit();
  }

  resizeWithKeys(event) {
    const step = paperKeySteps[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const { width, height } = this.panel.getBoundingClientRect();
    this.prefs.width = width + (this.prefs.docked ? -step[0] : step[0]);
    this.prefs.height = height + step[1];
    this.layout(this.prefs.locked || event.shiftKey ? width / height : undefined, step[0] ? 'width' : 'height');
    Object.assign(this.prefs, { width: this.panel.offsetWidth, height: this.panel.offsetHeight });
    this.commit();
  }
}

export function latexPoint(label) {
  const groups = /^([A-Za-z][A-Za-z0-9']*?)(?:_([A-Za-z0-9]+))?('*)$/.exec(label);
  if (!groups) return '\\texttt{' + [...label].map(char => /[A-Za-z0-9]/.test(char) ? char : '\\char' + char.codePointAt(0) + '{}').join('') + '}';
  const [, name, suffix, primes] = groups;
  return name + (suffix ? '_{' + suffix + '}' : '') + primes;
}

export class StudioInspector {
  constructor(app) {
    this.app = app;
    this.root = app.propertiesPanel.root;
    const content = document.createElement('div');
    content.id = 'studio-inspector-properties';
    content.append(...this.root.querySelectorAll(':scope > section'));
    const objects = document.getElementById('tab-pane-objects');
    this.root.insertAdjacentHTML('beforeend', `<div class="studio-inspector-tabs" role="tablist" aria-label="Bảng chi tiết">
      <button type="button" role="tab" id="studio-tab-properties" data-inspector-tab="properties">Tính chất</button>
      <button type="button" role="tab" id="studio-tab-objects" data-inspector-tab="objects">Đối tượng</button>
      <button type="button" role="tab" id="studio-tab-latex" data-inspector-tab="latex">LaTeX</button>
    </div>`);
    this.root.append(content, objects);
    this.root.insertAdjacentHTML('beforeend', `<div id="studio-inspector-latex">
      <label for="studio-latex-text">Ký hiệu đối tượng đang chọn</label>
      <textarea readonly id="studio-latex-text" rows="3" spellcheck="false"></textarea>
      <button type="button" id="studio-copy-latex">Chép LaTeX</button><p id="studio-latex-message" role="status"></p>
    </div>`);
    this.latex = this.root.querySelector('#studio-latex-text');
    this.copy = this.root.querySelector('#studio-copy-latex');
    this.copy.addEventListener('click', async () => {
      const status = this.root.querySelector('#studio-latex-message');
      try { await navigator.clipboard.writeText(this.latex.value); status.textContent = 'Đã chép LaTeX.'; }
      catch { this.latex.focus(); this.latex.select(); status.textContent = 'Văn bản đã được chọn để sao chép.'; }
    });
    this.panes = { properties: content, objects, latex: this.latex.parentElement };
    this.tabs = [...this.root.querySelectorAll('[data-inspector-tab]')];
    this.tabs.forEach((tab, index) => {
      const pane = this.panes[tab.dataset.inspectorTab];
      tab.setAttribute('aria-controls', pane.id);
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => this.show(tab.dataset.inspectorTab));
      tab.addEventListener('keydown', event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: this.tabs.length - 1 - index };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = this.tabs[(index + offsets[event.key] + this.tabs.length) % this.tabs.length];
        next.click();
        next.focus();
      });
    });
    this.root.querySelector('[data-close]').innerHTML = studioIcon('close');
    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target.closest('input,select,textarea')) return;
      this.app.propertiesPanel.setOpen(false);
      event.stopPropagation();
    });
    this.root.querySelector('.properties-head strong').textContent = 'Chi tiết hình';
    this.root.setAttribute('aria-label', 'Chi tiết hình');
    this.show('properties');
  }

  show(name) {
    this.active = name;
    for (const tab of this.tabs) {
      const selected = tab.dataset.inspectorTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const pane = this.panes[tab.dataset.inspectorTab];
      pane.hidden = !selected;
      pane.classList.toggle('hidden', !selected);
    }
    if (name === 'objects' && !this.root.hidden) this.app.renderObjectBrowser(true);
    this.refreshLatex();
  }

  refreshLatex() {
    if (this.root.hidden || this.active !== 'latex') return;
    const { selected } = this.app.editor;
    const scene = this.app.scene;
    const point = key => latexPoint(scene.getSpatialPoint(key)?.label || key);
    let value = '';
    if (selected?.kind === 'POINT') value = point(selected.id);
    if (selected?.kind === 'SEGMENT' && selected.u && selected.v) {
      const name = point(selected.u) + point(selected.v);
      const shape = scene.linearGeometry(selected)?.kind;
      value = shape === 'line' ? '\\overleftrightarrow{' + name + '}' : shape === 'ray' ? '\\overrightarrow{' + name + '}' : '[' + name + ']';
    }
    const text = value ? '\\(' + value + '\\)' : '';
    if (this.latex.value !== text) {
      this.latex.value = text;
      this.root.querySelector('#studio-latex-message').textContent = '';
    }
    this.latex.placeholder = 'Chọn một điểm hoặc đường trong hình.';
    this.copy.disabled = !text;
  }
}
