/* Einfacher Creator für eigene Tachos. Elemente antippen, verschieben, am grünen Punkt skalieren,
   unten Eigenschaften ändern. Speichert im Gerät, exportiert als .tacho.json. */
(function (root) {
  'use strict';
  const D = root.Design;
  const $ = (s, r) => (r || document).querySelector(s);
  const ASPECTS = [['2.1667', '20:9 quer'], ['2.0', '18:9 quer'], ['1.7778', '16:9 quer'], ['1.3333', '4:3 quer'], ['0.4615', '9:19,5 hochkant'], ['0.5', '9:18 hochkant'], ['0.5625', '9:16 hochkant'], ['0.75', '3:4 hochkant']];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  let st = null; // {d, sel, mount, onSave, api, edit}

  function el() {
    let c = $('#creator');
    if (c) return c;
    c = document.createElement('div'); c.id = 'creator';
    c.innerHTML = '<div id="cr-top"></div><div id="cr-stage"></div><div id="cr-pal"></div><div id="cr-prop"></div>';
    document.body.appendChild(c);
    return c;
  }

  function open(design, api, onSave) {
    const c = el();
    st = { d: design ? D.validate(JSON.parse(JSON.stringify(design))) : D.blank(), sel: null, api, onSave, edit: true, nid: 1 };
    st.d.els.forEach((e) => { const m = /^e(\d+)$/.exec(e.id); if (m) st.nid = Math.max(st.nid, +m[1] + 1); });
    c.classList.add('on');
    top(); palette(); redraw(); props();
    addEventListener('resize', onResize);
  }
  function close() { $('#creator').classList.remove('on'); removeEventListener('resize', onResize); st = null; }
  function onResize() { if (st) redraw(); }

  // ---------- Kopfleiste ----------
  function top() {
    const t = $('#cr-top'), d = st.d;
    t.innerHTML = `<input id="cr-name" value="${D.esc(d.name)}" maxlength="40">
      <select id="cr-asp" style="background:#05070b;color:#fff;border:1px solid #1c2840;border-radius:8px;padding:7px">${ASPECTS.map(([v, n]) => `<option value="${v}" ${Math.abs(+v - d.aspect) < 0.01 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button data-a="bg">Hintergrund</button><button data-a="prev">${st.edit ? 'Vorschau' : 'Bearbeiten'}</button>
      <button class="pri" data-a="save">Speichern</button><button data-a="exp">Exportieren</button><button data-a="close">✕</button>`;
    $('#cr-name').onchange = (e) => { st.d.name = e.target.value.trim().slice(0, 40) || 'Mein Tacho'; };
    $('#cr-asp').onchange = (e) => { st.d.aspect = +e.target.value; st.d.orient = st.d.aspect > 1 ? 'land' : 'port'; redraw(); };
    t.onclick = async (e) => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'close') { if (confirm('Schließen? Nicht gespeicherte Änderungen gehen verloren.')) close(); }
      if (a === 'save') { await D.Store.put(st.d); if (st.onSave) st.onSave(st.d); toast('Gespeichert: ' + st.d.name); }
      if (a === 'exp') exportDesign(st.d);
      if (a === 'prev') { st.edit = !st.edit; st.sel = null; top(); redraw(); props(); }
      if (a === 'bg') { st.sel = null; redraw(); bgProps(); }
    };
  }

  function toast(t) { if (st && st.api && st.api.toast) st.api.toast(t); }

  async function exportDesign(d) {
    const text = JSON.stringify(d), name = d.name.replace(/[^\wäöüÄÖÜß -]/g, '_') + '.tacho.json';
    try {
      const f = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: d.name }); return; }
    } catch (e) { /* abgebrochen oder nicht möglich */ }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Datei gespeichert: ' + name); }
    catch (e) { try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); } catch (e2) { toast('Export nicht möglich'); } }
  }

  // ---------- Palette ----------
  function palette() {
    const p = $('#cr-pal');
    p.innerHTML = Object.entries(D.TYPES).map(([k, n]) => `<button data-add="${k}">+ ${n}</button>`).join('');
    p.onclick = (e) => {
      const k = e.target.dataset.add; if (!k) return;
      const o = Object.assign({ id: 'e' + (st.nid++), t: k, x: 30, y: 30, rot: 0, op: 1, show: 'always' }, JSON.parse(JSON.stringify(D.DEFAULTS[k])));
      o.x = clamp(50 - o.w / 2, 0, 100 - o.w); o.y = clamp(50 - o.h / 2, 0, 100 - o.h);
      st.d.els.push(o); st.sel = o.id; st.edit = true; redraw(); props();
    };
  }

  // ---------- Bühne ----------
  function api() {
    const a = st.api, demo = D.DEMO;
    return {
      get: (s) => { const v = demo[s]; return typeof v === 'number' ? { n: v } : { n: null, t: String(v) }; },
      state: 'ok', limit: 70, limitKmh: 70, fu: 1, road: { name: 'Hauptstraße' }, next: { limit: { v: 50, kind: 'sign' }, dist: 130 },
      limitObj: { v: 70, kind: 'sign' }, signHTML: a.signHTML
    };
  }
  function redraw() {
    const stage = $('#cr-stage');
    st.mount = D.mount(stage, st.d, { edit: st.edit });
    stage.classList.toggle('dz-edit', st.edit);
    st.mount.update(api());
    selBox();
    if (st.edit) bindStage();
  }
  const rectOf = (n) => n.getBoundingClientRect();
  function selBox() {
    const old = $('.cr-sel', $('#cr-stage')); if (old) old.remove();
    if (!st.edit || !st.sel) return;
    const node = st.mount.nodes.find((o) => o.e.id === st.sel); if (!node) return;
    const b = document.createElement('div'); b.className = 'cr-sel';
    const cr = st.mount.canvas.getBoundingClientRect(), sr = $('#cr-stage').getBoundingClientRect(), r = rectOf(node.n);
    b.style.cssText = `left:${r.left - sr.left}px;top:${r.top - sr.top}px;width:${r.width}px;height:${r.height}px`;
    b.innerHTML = '<div class="cr-hdl"></div>';
    $('#cr-stage').appendChild(b);
    bindHandle(b.querySelector('.cr-hdl'));
  }
  function pct(ev) {
    const cr = st.mount.canvas.getBoundingClientRect();
    return [(ev.clientX - cr.left) / cr.width * 100, (ev.clientY - cr.top) / cr.height * 100];
  }
  function bindStage() {
    const stage = $('#cr-stage');
    stage.onpointerdown = (ev) => {
      if (ev.target.classList.contains('cr-hdl')) return;
      const n = ev.target.closest('.dz-el');
      if (!n) { st.sel = null; selBox(); props(); return; }
      const e = st.d.els.find((x) => x.id === n.dataset.id); if (!e) return;
      st.sel = e.id; selBox(); props();
      const [px, py] = pct(ev), ox = e.x, oy = e.y; let moved = false;
      stage.setPointerCapture(ev.pointerId);
      stage.onpointermove = (m) => {
        const [qx, qy] = pct(m); moved = true;
        e.x = +clamp(ox + qx - px, -20, 100).toFixed(1); e.y = +clamp(oy + qy - py, -20, 100).toFixed(1);
        n.style.left = e.x + '%'; n.style.top = e.y + '%'; selBox();
      };
      stage.onpointerup = () => { stage.onpointermove = null; stage.onpointerup = null; if (moved) props(); };
    };
  }
  function bindHandle(h) {
    h.onpointerdown = (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      const e = st.d.els.find((x) => x.id === st.sel), n = st.mount.nodes.find((o) => o.e.id === st.sel).n, box = h.parentNode;
      h.setPointerCapture(ev.pointerId);
      h.onpointermove = (m) => {
        const [qx, qy] = pct(m);
        e.w = +clamp(qx - e.x, 2, 100).toFixed(1); e.h = +clamp(qy - e.y, 2, 100).toFixed(1);
        n.style.width = e.w + '%'; n.style.height = e.h + '%';
        const r = rectOf(n); box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
      };
      h.onpointerup = () => { h.onpointermove = null; h.onpointerup = null; props(); redraw(); };
    };
  }

  // ---------- Eigenschaften ----------
  const fld = (k, label, type, e, extra) => {
    if (type === 'select') return `<label>${label}<select data-k="${k}">${extra.map(([v, t]) => `<option value="${v}" ${String(e[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    if (type === 'check') return `<label><input type="checkbox" data-k="${k}" ${e[k] ? 'checked' : ''}>${label}</label>`;
    if (type === 'color') return `<label>${label}<input type="color" data-k="${k}" value="${/^#[0-9a-f]{6}$/i.test(e[k]) ? e[k] : '#ffffff'}"></label>`;
    if (type === 'text') return `<label>${label}<input type="text" data-k="${k}" value="${D.esc(e[k] == null ? '' : e[k])}"></label>`;
    return `<label>${label}<input type="number" data-k="${k}" value="${e[k]}" step="${(extra && extra.step) || 1}"></label>`;
  };
  function props() {
    const p = $('#cr-prop');
    const e = st.sel && st.d.els.find((x) => x.id === st.sel);
    if (!e || !st.edit) { p.innerHTML = '<div class="pr" style="color:#9fb0c8">' + (st.edit ? 'Element antippen zum Bearbeiten, unten „+“ zum Hinzufügen.' : 'Vorschau mit Beispielwerten.') + '</div>'; p.onchange = null; return; }
    const src = D.SRC.map(([v, t]) => [v, t]);
    let h = `<div class="pr"><b>${D.TYPES[e.t]}</b>
      <button data-act="dup">Kopie</button><button data-act="front">nach vorn</button><button data-act="back">nach hinten</button><button data-act="del">Löschen</button></div>`;
    h += '<div class="pr">' + ['x', 'y', 'w', 'h'].map((k) => fld(k, k.toUpperCase() + ' %', 'num', e, { step: 0.5 })).join('') + fld('rot', 'Drehung°', 'num', e) + fld('op', 'Deckkraft', 'num', e, { step: 0.1 }) + fld('show', 'Zeigen', 'select', e, D.SHOW) + '</div>';
    const row = (...f) => (h += '<div class="pr">' + f.join('') + '</div>');
    const textStyle = () => row(fld('size', 'Größe', 'num', e, { step: 0.5 }), fld('color', 'Farbe', 'color', e), fld('font', 'Schrift', 'select', e, Object.keys(D.FONTS).map((k) => [k, k])), fld('weight', 'Stärke', 'select', e, [[400, 'normal'], [600, 'halbfett'], [800, 'fett']]), fld('align', 'Ausrichtung', 'select', e, [['l', 'links'], ['c', 'Mitte'], ['r', 'rechts']]));
    switch (e.t) {
      case 'text': row(fld('text', 'Text', 'text', e)); textStyle(); break;
      case 'value': row(fld('src', 'Wert', 'select', e, src), fld('dec', 'Nachkomma', 'num', e), fld('pad', 'Ziffern', 'num', e), fld('unit', 'Einheit', 'text', e), fld('stc', 'Farbe nach Limit', 'check', e)); textStyle(); break;
      case 'road': textStyle(); break;
      case 'rect': row(fld('color', 'Farbe', 'color', e), fld('radius', 'Rundung %', 'num', e), fld('border', 'Rand', 'num', e, { step: 0.1 }), fld('borderColor', 'Randfarbe', 'color', e)); break;
      case 'image': row(`<button data-act="img">Bild wählen</button>`, fld('fit', 'Anpassen', 'select', e, [['contain', 'einpassen'], ['cover', 'füllen'], ['fill', 'strecken']])); break;
      case 'bar': row(fld('src', 'Wert', 'select', e, src), fld('min', 'Min', 'num', e), fld('max', 'Max', 'num', e), fld('dir', 'Richtung', 'select', e, [['r', '→'], ['l', '←'], ['u', '↑'], ['d', '↓']]), fld('segs', 'Segmente', 'num', e)); row(fld('color', 'Farbe', 'color', e), fld('bg', 'Hintergrund', 'color', e), fld('radius', 'Rundung', 'num', e), fld('stc', 'Farbe nach Limit', 'check', e), fld('limitMark', 'Limit-Marke', 'check', e)); break;
      case 'arc': row(fld('src', 'Wert', 'select', e, src), fld('min', 'Min', 'num', e), fld('max', 'Max', 'num', e), fld('a0', 'Start°', 'num', e), fld('a1', 'Ende°', 'num', e), fld('thick', 'Dicke', 'num', e, { step: 0.5 })); row(fld('color', 'Farbe', 'color', e), fld('bg', 'Hintergrund', 'color', e), fld('stc', 'Farbe nach Limit', 'check', e)); break;
      case 'needle': row(fld('src', 'Wert', 'select', e, src), fld('min', 'Min', 'num', e), fld('max', 'Max', 'num', e), fld('a0', 'Start°', 'num', e), fld('a1', 'Ende°', 'num', e)); row(fld('len', 'Länge %', 'num', e), fld('width', 'Dicke', 'num', e, { step: 0.5 }), fld('color', 'Farbe', 'color', e), fld('hub', 'Nabe', 'check', e)); break;
      case 'dial': row(fld('min', 'Min', 'num', e), fld('max', 'Max', 'num', e), fld('step', 'Schritt', 'num', e), fld('minor', 'Zwischenstriche', 'num', e), fld('a0', 'Start°', 'num', e), fld('a1', 'Ende°', 'num', e)); row(fld('size', 'Zahlengröße', 'num', e, { step: 0.5 }), fld('color', 'Farbe', 'color', e), fld('font', 'Schrift', 'select', e, Object.keys(D.FONTS).map((k) => [k, k])), fld('lim', 'Limit-Marke', 'check', e)); break;
      case 'next': row(fld('size', 'Größe', 'num', e, { step: 0.5 })); break;
      default: break;
    }
    p.innerHTML = h;
    p.onchange = (ev) => {
      const t = ev.target, k = t.dataset.k; if (!k) return;
      e[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : (['weight'].includes(k) ? +t.value : t.value);
      redraw();
      if (['src', 'show', 'dir'].includes(k)) props();
    };
    p.onclick = async (ev) => {
      const a = ev.target.dataset.act; if (!a) return;
      const i = st.d.els.indexOf(e);
      if (a === 'del') { st.d.els.splice(i, 1); st.sel = null; }
      if (a === 'dup') { const c = Object.assign({}, JSON.parse(JSON.stringify(e)), { id: 'e' + (st.nid++), x: e.x + 3, y: e.y + 3 }); st.d.els.push(c); st.sel = c.id; }
      if (a === 'front') { st.d.els.push(st.d.els.splice(i, 1)[0]); }
      if (a === 'back') { st.d.els.unshift(st.d.els.splice(i, 1)[0]); }
      if (a === 'img') { const f = await pickFile('image/*'); if (f) e.img = await D.fileToDataUrl(f, 1200); }
      redraw(); props();
    };
  }

  function bgProps() {
    const p = $('#cr-prop'), b = st.d.bg;
    p.innerHTML = `<div class="pr"><b>Hintergrund</b>
      <label>Farbe<input type="color" data-b="color" value="${b.color}"></label>
      <label>Anpassen<select data-b="fit">${[['cover', 'füllen'], ['contain', 'einpassen'], ['fill', 'strecken']].map(([v, t]) => `<option value="${v}" ${b.fit === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <button data-act="bgimg">Bild wählen</button><button data-act="bgclr">Bild entfernen</button></div>
      <div class="pr" style="color:#9fb0c8">Tipp: Ein Hintergrundbild mit Skalen und Rahmen passt zu Nadeln, Balken und Werten darüber.</div>`;
    p.onchange = (ev) => { const k = ev.target.dataset.b; if (k) { b[k] = ev.target.value; redraw(); } };
    p.onclick = async (ev) => {
      const a = ev.target.dataset.act;
      if (a === 'bgimg') { const f = await pickFile('image/*'); if (f) { b.image = await D.fileToDataUrl(f, 1800); redraw(); } }
      if (a === 'bgclr') { b.image = ''; redraw(); }
    };
  }

  function pickFile(accept) {
    return new Promise((res) => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.style.display = 'none';
      i.onchange = () => { res(i.files[0] || null); i.remove(); };
      document.body.appendChild(i); i.click();
    });
  }

  root.Creator = { open, close, pickFile };
})(window);
