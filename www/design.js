/* Eigene Tacho-Designs: Format, Speicher (IndexedDB), Darstellung.
   Ein Design ist eine JSON-Datei (*.tacho.json) mit Hintergrund und Elementen in Prozent der Fläche.
   Bilder stecken als Data-URL in der Datei, damit eine Datei alles enthält. */
(function (root) {
  'use strict';

  const SRC = [
    ['speed', 'Tempo (aktuelle Einheit)'], ['kmh', 'Tempo in km/h (fest)'], ['limit', 'Tempolimit'], ['free', 'Spielraum zum Limit'],
    ['rpm', 'Drehzahl (OBD)'], ['alt', 'Höhe'], ['altnn', 'Höhe über Normalnull'], ['altnap', 'Höhe über Amsterdamer Null'], ['altell', 'Höhe über Ellipsoid'], ['dir', 'Richtung in Grad'], ['dirname', 'Richtung als Buchstabe'], ['acc', 'Beschleunigung'], ['g', 'G-Kraft'],
    ['max', 'Höchsttempo heute'], ['avg', 'Durchschnitt Trip'], ['time', 'Fahrzeit Trip'], ['day', 'Tageskilometer'], ['trip', 'Trip-Kilometer'], ['total', 'Gesamtkilometer'],
    ['clock', 'Uhrzeit'], ['date', 'Datum'], ['gps', 'GPS-Genauigkeit'], ['sat', 'Satelliten'], ['temp', 'Außentemperatur'], ['gust', 'Böen'], ['grade', 'Steigung'],
    ['cool', 'Kühlmittel (OBD)'], ['oil', 'Öltemperatur (OBD)'], ['thr', 'Gaspedal (OBD)'], ['load', 'Motorlast (OBD)'], ['volt', 'Bordspannung (OBD)'], ['fuel', 'Tankfüllung (OBD)'], ['l100', 'Verbrauch (OBD)']
  ];
  const TYPES = { text: 'Text', value: 'Wert', bar: 'Balken', arc: 'Bogen', needle: 'Nadel', dial: 'Skala', rect: 'Fläche', image: 'Bild', sign: 'Tempo-Schild', road: 'Straßenname', next: 'Nächstes Limit' };
  const SHOW = [['always', 'immer'], ['over', 'nur zu schnell'], ['near', 'nur knapp drüber'], ['ok', 'nur im Limit'], ['notover', 'nicht zu schnell'], ['hasLimit', 'nur wenn Limit bekannt'], ['noLimit', 'nur ohne Limit']];
  const FONTS = { sans: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', mono: 'ui-monospace,"Roboto Mono",Menlo,monospace', condensed: '"Arial Narrow","Roboto Condensed",sans-serif-condensed,sans-serif', serif: 'Georgia,"Times New Roman",serif', digital: '"Courier New",ui-monospace,monospace' };

  const DEFAULTS = {
    text: { w: 30, h: 10, text: 'Text', size: 6, color: '#ffffff', font: 'sans', weight: 600, align: 'c' },
    value: { w: 30, h: 20, src: 'speed', dec: 0, pad: 0, unit: '', size: 14, color: '#ffffff', font: 'sans', weight: 800, align: 'c', stc: false },
    bar: { w: 60, h: 6, src: 'speed', min: 0, max: 240, dir: 'r', color: '#3ddc97', bg: '#1c2840', radius: 50, segs: 0, stc: true, limitMark: true },
    arc: { w: 40, h: 40, src: 'speed', min: 0, max: 240, a0: -135, a1: 135, thick: 8, color: '#3ddc97', bg: '#1c2840', stc: true },
    needle: { w: 40, h: 40, src: 'speed', min: 0, max: 240, a0: -135, a1: 135, len: 90, width: 3, color: '#ff3b30', hub: true },
    dial: { w: 40, h: 40, min: 0, max: 240, step: 20, minor: 4, a0: -135, a1: 135, color: '#ffffff', size: 4, font: 'sans', lim: true },
    rect: { w: 20, h: 10, color: '#101826', radius: 10, border: 0, borderColor: '#1c2840' },
    image: { w: 30, h: 30, img: '', fit: 'contain' },
    sign: { w: 20, h: 20 },
    road: { w: 40, h: 8, size: 5, color: '#ffffff', font: 'sans', weight: 700, align: 'l' },
    next: { w: 30, h: 10, size: 4 }
  };

  const DEMO = { speed: 87, kmh: 87, limit: 70, free: -17, rpm: 3200, alt: 78, dir: 45, dirname: 'NO', acc: 1.2, g: 0.2, max: 142, avg: 63, time: '1:42', day: 38.4, trip: 124.7, total: 48210, clock: '18:32', date: 'Sa., 21. Nov.', gps: 5, sat: '17/24', temp: 8, gust: 32, grade: 2.4, cool: 90, oil: 96, thr: 28, load: 42, volt: 14.1, fuel: 63, l100: 6.8 };

  function blank(name) {
    return { format: 'tacho-design', v: 1, name: name || 'Mein Tacho', aspect: 2, orient: 'land', bg: { color: '#070b12', image: '', fit: 'cover' }, els: [] };
  }

  function validate(d) {
    if (!d || d.format !== 'tacho-design' || !Array.isArray(d.els)) throw new Error('Das ist keine Tacho-Design-Datei');
    d.name = String(d.name || 'Design').slice(0, 40);
    d.aspect = +d.aspect > 0.3 && +d.aspect < 4 ? +d.aspect : 2;
    d.bg = Object.assign({ color: '#070b12', image: '', fit: 'cover' }, d.bg || {});
    d.els = d.els.filter((e) => e && TYPES[e.t]).map((e, i) => Object.assign({ id: 'e' + i, x: 10, y: 10, rot: 0, op: 1, show: 'always' }, DEFAULTS[e.t], e));
    return d;
  }

  // ---------- Speicher ----------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('tacho-designs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('d', { keyPath: 'name' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => { const t = d.transaction('d', mode), s = t.objectStore('d'); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  const Store = {
    list: () => tx('readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => x.name.localeCompare(y.name))),
    get: (name) => tx('readonly', (s) => s.get(name)),
    put: (d) => tx('readwrite', (s) => s.put(d)),
    del: (name) => tx('readwrite', (s) => s.delete(name))
  };

  // ---------- Darstellung ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pol = (cx, cy, r, a) => { const t = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
  function arcPath(cx, cy, r, a0, a1) {
    const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  const frac = (n, min, max) => Math.max(0, Math.min(1, (n - min) / ((max - min) || 1)));
  const fmtN = (v, dec, pad) => { let s = (+v).toFixed(dec || 0).replace('.', ','); if (pad) { const [i, f] = s.split(','); s = i.padStart(pad, '0') + (f ? ',' + f : ''); } return s; };

  /* Mount: baut die Elemente einmal auf und liefert update(api) für die Werte.
     api: {get(src)->{n,t}, state, limit, road, next, signHTML(limit,el)} */
  function mount(host, d, opts) {
    opts = opts || {};
    host.innerHTML = '';
    host.classList.add('dz-host');
    const canvas = document.createElement('div');
    canvas.className = 'dz-canvas';
    host.appendChild(canvas);
    const bg = document.createElement('div'); bg.className = 'dz-bg'; canvas.appendChild(bg);
    const nodes = [];

    function layout() {
      const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return;
      let w = W, h = W / d.aspect; if (h > H) { h = H; w = H * d.aspect; }
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.style.setProperty('--u', (h / 100) + 'px'); canvas.style.setProperty('--uw', (w / 100) + 'px');
    }
    layout();
    bg.style.background = d.bg.color;
    if (d.bg.image) { bg.style.backgroundImage = `url("${d.bg.image}")`; bg.style.backgroundSize = d.bg.fit === 'fill' ? '100% 100%' : (d.bg.fit || 'cover'); bg.style.backgroundPosition = 'center'; bg.style.backgroundRepeat = 'no-repeat'; }
    host.style.background = d.bg.color;

    d.els.forEach((e) => {
      const n = document.createElement('div'); n.className = 'dz-el dz-' + e.t; n.dataset.id = e.id;
      n.style.cssText = `left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;opacity:${e.op};transform:rotate(${e.rot || 0}deg)`;
      let inner = null;
      const sizeCss = `font-size:calc(var(--u)*${e.size || 6});color:${e.color};font-family:${FONTS[e.font] || FONTS.sans};font-weight:${e.weight || 600};justify-content:${e.align === 'l' ? 'flex-start' : e.align === 'r' ? 'flex-end' : 'center'}`;
      switch (e.t) {
        case 'text': n.style.cssText += ';' + sizeCss; n.textContent = e.text; break;
        case 'value': n.style.cssText += ';' + sizeCss; n.innerHTML = '<span class="v"></span>' + (e.unit ? `<small>${esc(e.unit)}</small>` : ''); inner = n.querySelector('.v'); break;
        case 'road': n.style.cssText += ';' + sizeCss; n.innerHTML = '<span class="v"></span>'; inner = n.querySelector('.v'); break;
        case 'rect': n.style.background = e.color; n.style.borderRadius = e.radius + '%'; if (e.border) n.style.border = `calc(var(--u)*${e.border}) solid ${e.borderColor}`; break;
        case 'image': if (e.img) n.style.cssText += `;background:url("${e.img}") center/${e.fit === 'fill' ? '100% 100%' : (e.fit || 'contain')} no-repeat`; break;
        case 'sign': n.innerHTML = '<div class="sign dz-sign"><span></span></div>'; break;
        case 'next': n.innerHTML = '<div class="dz-next"><div class="sign"><span></span></div><b></b></div>'; n.style.fontSize = `calc(var(--u)*${e.size || 4})`; break;
        case 'bar': {
          n.style.background = e.bg; n.style.borderRadius = e.radius + 'px'; n.style.overflow = 'hidden';
          n.innerHTML = '<i class="f"></i><b class="m"></b>';
          if (e.segs > 1) { n.style.setProperty('--segs', e.segs); n.classList.add('segs'); }
          break;
        }
        case 'arc': case 'needle': case 'dial': {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.style.cssText = 'width:100%;height:100%;overflow:visible';
          if (e.t === 'arc') {
            const r = 50 - e.thick / 2;
            svg.innerHTML = `<path d="${arcPath(50, 50, r, e.a0, e.a1)}" fill="none" stroke="${e.bg}" stroke-width="${e.thick}" stroke-linecap="round"/><path class="a" d="${arcPath(50, 50, r, e.a0, e.a0 + 0.01)}" fill="none" stroke="${e.color}" stroke-width="${e.thick}" stroke-linecap="round"/>`;
          } else if (e.t === 'needle') {
            svg.innerHTML = `<g class="g"><line x1="50" y1="50" x2="50" y2="${50 - 50 * e.len / 100}" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round"/></g>${e.hub ? `<circle cx="50" cy="50" r="${e.width * 1.8}" fill="${e.color}"/>` : ''}`;
          } else {
            let g = ''; const total = Math.max(1, Math.round((e.max - e.min) / e.step));
            for (let i = 0; i <= total; i++) {
              const a = e.a0 + (e.a1 - e.a0) * i / total, [x0, y0] = pol(50, 50, 47, a), [x1, y1] = pol(50, 50, 40, a), [tx, ty] = pol(50, 50, 31, a);
              g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${e.color}" stroke-width="1.2" stroke-linecap="round"/>`;
              g += `<text x="${tx}" y="${ty}" fill="${e.color}" font-size="${e.size * 2.2}" text-anchor="middle" dominant-baseline="central" font-family="${FONTS[e.font] || FONTS.sans}" font-weight="600">${Math.round(e.min + (e.max - e.min) * i / total)}</text>`;
              if (i < total) for (let k = 1; k <= e.minor; k++) { const a2 = a + (e.a1 - e.a0) / total * k / (e.minor + 1), [m0, n0] = pol(50, 50, 47, a2), [m1, n1] = pol(50, 50, 43.5, a2); g += `<line x1="${m0}" y1="${n0}" x2="${m1}" y2="${n1}" stroke="${e.color}" stroke-opacity=".6" stroke-width=".6"/>`; }
            }
            svg.innerHTML = g + (e.lim ? '<line class="lm" x1="50" y1="2" x2="50" y2="14" stroke="#ff3b30" stroke-width="2.4" stroke-linecap="round"/>' : '');
          }
          n.appendChild(svg); break;
        }
        default: break;
      }
      canvas.appendChild(n);
      nodes.push({ e, n, inner, last: '' });
    });

    function update(api) {
      for (const o of nodes) {
        const e = o.e, n = o.n;
        if (!opts.edit && e.show && e.show !== 'always') {
          const st = api.state, hasL = api.limit != null;
          const vis = e.show === 'over' ? st === 'over' : e.show === 'near' ? st === 'near' : e.show === 'ok' ? st === 'ok' : e.show === 'notover' ? st !== 'over' : e.show === 'hasLimit' ? hasL : e.show === 'noLimit' ? !hasL : true;
          n.style.visibility = vis ? 'visible' : 'hidden';
        } else n.style.visibility = 'visible';
        const col = e.stc ? 'var(--st)' : e.color;
        switch (e.t) {
          case 'value': { const v = api.get(e.src); const txt = v.n != null ? fmtN(v.n, e.dec, e.pad) : (v.t != null ? v.t : '–'); if (o.last !== txt) { o.inner.textContent = txt; o.last = txt; } n.style.color = col; break; }
          case 'road': { const t = api.road ? (api.road.name || api.road.ref || '') : ''; if (o.last !== t) { o.inner.textContent = t; o.last = t; } break; }
          case 'sign': api.signHTML(api.limitObj, n.querySelector('.sign')); break;
          case 'next': { const nx = api.next; n.style.visibility = nx ? 'visible' : 'hidden'; if (nx) { api.signHTML(nx.limit, n.querySelector('.sign')); n.querySelector('b').textContent = 'in ' + Math.max(10, Math.round(nx.dist / 10) * 10) + ' m'; } break; }
          case 'bar': {
            const v = api.get(e.src), f = frac(v.n == null ? 0 : v.n, e.min, e.max), fill = n.querySelector('.f'), m = n.querySelector('.m');
            const horiz = e.dir === 'r' || e.dir === 'l';
            fill.style.cssText = `position:absolute;background:${e.grad && horiz ? `linear-gradient(to ${e.dir === 'r' ? 'right' : 'left'},${e.grad});background-size:${f > 0.02 ? (100 / f).toFixed(1) : 5000}% 100%;background-repeat:no-repeat` : col};${horiz ? `top:0;bottom:0;${e.dir === 'r' ? 'left' : 'right'}:0;width:${f * 100}%` : `left:0;right:0;${e.dir === 'u' ? 'bottom' : 'top'}:0;height:${f * 100}%`}`;
            if (e.limitMark) { const lm = api.limitKmh; if (lm != null && (e.src === 'speed' || e.src === 'kmh')) { const lf = frac(lm * (e.src === 'speed' ? api.fu : 1), e.min, e.max) * 100; m.style.cssText = `position:absolute;background:#fff;${horiz ? `top:0;bottom:0;width:3px;${e.dir === 'r' ? 'left' : 'right'}:calc(${e.dir === 'r' ? lf : 100 - lf}% - 1px)` : `left:0;right:0;height:3px;bottom:calc(${lf}% - 1px)`}`; m.style.display = ''; } else m.style.display = 'none'; } else m.style.display = 'none';
            break;
          }
          case 'arc': { const v = api.get(e.src), a = e.a0 + (e.a1 - e.a0) * frac(v.n == null ? 0 : v.n, e.min, e.max); n.querySelector('.a').setAttribute('d', arcPath(50, 50, 50 - e.thick / 2, e.a0, Math.max(e.a0 + 0.01, a))); n.querySelector('.a').setAttribute('stroke', col === 'var(--st)' ? getComputedStyle(document.body).getPropertyValue('--st') || e.color : col); break; }
          case 'needle': { const v = api.get(e.src), a = e.a0 + (e.a1 - e.a0) * frac(v.n == null ? 0 : v.n, e.min, e.max); n.querySelector('.g').setAttribute('transform', `rotate(${a.toFixed(1)} 50 50)`); break; }
          case 'dial': { const lm = n.querySelector('.lm'); if (lm) { const l = api.limitKmh; if (l == null) lm.style.display = 'none'; else { lm.style.display = ''; const a = e.a0 + (e.a1 - e.a0) * frac(l * api.fu, e.min, e.max); lm.setAttribute('transform', `rotate(${a.toFixed(1)} 50 50)`); } } break; }
          default: break;
        }
      }
    }
    return { update, layout, canvas, nodes, destroy() { host.innerHTML = ''; } };
  }

  // Datei oder Text -> geprüftes Design
  function parse(text) {
    let t = String(text).trim();
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1].trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(a, b + 1);
    return validate(JSON.parse(t));
  }

  // Bild verkleinern und als Data-URL zurückgeben (Dateigröße klein halten)
  function fileToDataUrl(file, maxPx) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(fr.error);
      fr.onload = () => {
        if (/svg/.test(file.type)) return res(fr.result);
        const img = new Image();
        img.onerror = () => rej(new Error('Bild nicht lesbar'));
        img.onload = () => {
          const k = Math.min(1, (maxPx || 1600) / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL(/png/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  const api = { SRC, TYPES, SHOW, FONTS, DEFAULTS, DEMO, blank, validate, parse, Store, mount, fileToDataUrl, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Design = api;
})(typeof window !== 'undefined' ? window : globalThis);
