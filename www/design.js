/* Eigene Tacho-Designs: Format, Speicher (IndexedDB), Darstellung.
   Ein Design ist eine JSON-Datei (*.tacho.json) mit Hintergrund und Elementen in Prozent der Fläche.
   Bilder stecken als Data-URL in der Datei, damit eine Datei alles enthält. */
(function (root) {
  'use strict';

  const SRC = [
    ['speed', 'Tempo (aktuelle Einheit)'], ['kmh', 'Tempo in km/h (fest)'], ['limit', 'Tempolimit'], ['free', 'Spielraum zum Limit'],
    ['alt', 'Höhe'], ['altnn', 'Höhe über Normalnull'], ['altnap', 'Höhe über Amsterdamer Null'], ['altell', 'Höhe über Ellipsoid'], ['dir', 'Richtung in Grad'], ['dirname', 'Richtung als Buchstabe'], ['acc', 'Beschleunigung'], ['g', 'G-Kraft'],
    ['max', 'Höchsttempo heute'], ['avg', 'Durchschnitt Trip'], ['time', 'Fahrzeit Trip'], ['day', 'Tageskilometer'], ['trip', 'Trip-Kilometer'], ['total', 'Gesamtkilometer'],
    ['clock', 'Uhrzeit'], ['date', 'Datum'], ['gps', 'GPS-Genauigkeit'], ['sat', 'Satelliten'], ['temp', 'Außentemperatur'], ['gust', 'Böen'], ['grade', 'Steigung'],
    ['wind', 'Windgeschwindigkeit'], ['winddir', 'Windrichtung'], ['hum', 'Luftfeuchte'], ['feels', 'Gefühlte Temperatur'], ['wx', 'Wetter als Text'], ['rain', 'Niederschlag'], ['ref', 'Straßennummer (z. B. A 42)'], ['roadname', 'Straßenname als Wert'], ['battery', 'Handy-Akku'], ['lat', 'Breitengrad'], ['lon', 'Längengrad'], 
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

  const DEMO = { speed: 87, kmh: 87, limit: 70, free: -17, alt: 78, dir: 45, dirname: 'NO', acc: 1.2, g: 0.2, max: 142, avg: 63, time: '1:42', day: 38.4, trip: 124.7, total: 48210, clock: '18:32', date: 'Sa., 21. Nov.', gps: 5, sat: '17/24', temp: 8, gust: 32, grade: 2.4, l100: 6.8 };

  function blank(name) {
    return { format: 'tacho-design', v: 1, name: name || 'Mein Tacho', aspect: 2, orient: 'land', bg: { color: '#070b12', image: '', fit: 'cover' }, els: [] };
  }

  // KI-Dateien weichen oft ab: andere Namen für Felder, Typen und Werte. Hier wird alles auf das App-Format gebracht.
  const SRCALIAS = {
    geschwindigkeit: 'speed', tempo: 'speed', velocity: 'speed', speed_kmh: 'kmh', kph: 'kmh', speedkmh: 'kmh', gps_speed: 'speed',
    speedlimit: 'limit', speed_limit: 'limit', maxspeed: 'limit', tempolimit: 'limit', limit_kmh: 'limit',
    altitude: 'alt', hoehe: 'alt', höhe: 'alt', elevation: 'alt', height: 'alt', alt_nn: 'altnn', msl: 'altnn', alt_nap: 'altnap', nap: 'altnap', ellipsoid: 'altell', alt_ell: 'altell',
    heading: 'dir', bearing: 'dir', course: 'dir', richtung: 'dir', direction: 'dirname', compass: 'dirname', kompass: 'dirname', heading_text: 'dirname', dir_name: 'dirname', cardinal: 'dirname',
    accel: 'acc', acceleration: 'acc', beschleunigung: 'acc', gforce: 'g', g_force: 'g', gkraft: 'g', 'g-kraft': 'g', lateral_g: 'g',
    maxspeed_today: 'max', max_speed: 'max', topspeed: 'max', top_speed: 'max', hoechsttempo: 'max', avg_speed: 'avg', average: 'avg', avgspeed: 'avg', durchschnitt: 'avg',
    fahrzeit: 'time', drive_time: 'time', duration: 'time', triptime: 'time', trip_time: 'time',
    daykm: 'day', day_km: 'day', tageskilometer: 'day', today: 'day', tripkm: 'trip', trip_km: 'trip', distance: 'trip', strecke: 'trip',
    odo: 'total', odometer: 'total', gesamt: 'total', gesamtkilometer: 'total', total_km: 'total', totalkm: 'total',
    time_of_day: 'clock', uhrzeit: 'clock', uhr: 'clock', datum: 'date', day_date: 'date',
    accuracy: 'gps', gps_accuracy: 'gps', genauigkeit: 'gps', satellites: 'sat', sats: 'sat', satelliten: 'sat', satellite: 'sat',
    temperature: 'temp', temperatur: 'temp', outside_temp: 'temp', aussentemperatur: 'temp', aussentemp: 'temp', outtemp: 'temp',
    gusts: 'gust', boeen: 'gust', böen: 'gust', windgust: 'gust', wind_gust: 'gust', wind_speed: 'wind', windspeed: 'wind', wind_direction: 'winddir', humidity: 'hum', luftfeuchte: 'hum', feels_like: 'feels', weather: 'wx', wetter: 'wx', precipitation: 'rain', regen: 'rain',
    slope: 'grade', steigung: 'grade', incline: 'grade',
    road: 'roadname', street: 'roadname', strasse: 'roadname', straße: 'roadname', road_ref: 'ref', akku: 'battery', phone_battery: 'battery'
  };
  const TYPEALIAS = { label: 'text', title: 'text', caption: 'text', number: 'value', readout: 'value', gauge_value: 'value', data: 'value', progress: 'bar', progressbar: 'bar', gauge: 'arc', ring: 'arc', pointer: 'needle', hand: 'needle', scale: 'dial', ticks: 'dial', box: 'rect', panel: 'rect', card: 'rect', shape: 'rect', circle: 'rect', img: 'image', picture: 'image', speedlimit: 'sign', limit: 'sign', limitsign: 'sign', street: 'road', roadname: 'road', nextlimit: 'next' };
  const FIELDALIAS = { type: 't', kind: 't', source: 'src', value: 'src', data: 'src', width: 'w', height: 'h', left: 'x', top: 'y', fontSize: 'size', font_size: 'size', fontsize: 'size', colour: 'color', fill: 'color', background: 'bg', fontWeight: 'weight', textAlign: 'align', opacity: 'op', rotation: 'rot', angle: 'rot', borderWidth: 'border', strokeColor: 'borderColor', decimals: 'dec', startAngle: 'a0', endAngle: 'a1', thickness: 'thick', length: 'len', label: 'text', content: 'text', visible: 'show' };
  const NUMF = ['x', 'y', 'w', 'h', 'rot', 'op', 'size', 'dec', 'pad', 'min', 'max', 'a0', 'a1', 'thick', 'len', 'width', 'radius', 'border', 'segs', 'step', 'minor', 'gs', 'gang', 'bang', 'ins', 'rgs', 'shine', 'dim', 'red', 'tail', 'n', 'weight'];
  const SRCSET = new Set(SRC.map((s) => s[0]));
  function normSrc(v) { if (v == null) return v; let k = String(v).trim(); if (SRCSET.has(k)) return k; const l = k.toLowerCase().replace(/[\s.]+/g, '_'); if (SRCSET.has(l)) return l; return SRCALIAS[l] || SRCALIAS[l.replace(/_/g, '')] || k; }
  function normEl(e0, warn) {
    const e = {};
    for (const [k, v] of Object.entries(e0)) { const nk = (k in FIELDALIAS && !(FIELDALIAS[k] in e0)) ? FIELDALIAS[k] : k; e[nk] = v; }
    if (typeof e.t === 'string') { const t = e.t.toLowerCase().replace(/[\s_-]/g, ''); if (!TYPES[e.t]) e.t = TYPES[t] ? t : (TYPEALIAS[t] || e.t); if (t === 'circle') e.shape = 'circle'; }
    if (e.t === 'value' && e.src == null && typeof e.text === 'string') { const s = normSrc(e.text.replace(/[{}$]/g, '')); if (SRCSET.has(s)) { e.src = s; delete e.text; } }
    if (e.t === 'text' && e.src != null && SRCSET.has(normSrc(e.src))) e.t = 'value';
    if (e.src != null) { const s = normSrc(e.src); if (!SRCSET.has(s)) { warn.push('Unbekannter Wert „' + e.src + '“ (' + (e.text || e.id || e.t) + ') → Tempo'); e.src = 'speed'; } else e.src = s; }
    for (const f of NUMF) if (typeof e[f] === 'string' && e[f].trim() !== '' && !isNaN(parseFloat(e[f]))) e[f] = parseFloat(e[f]);
    if (typeof e.weight === 'string') e.weight = /bold|fett/i.test(e.weight) ? 800 : 600;
    if (typeof e.align === 'string') e.align = /^(l|left|links|start)/i.test(e.align) ? 'l' : /^(r|right|rechts|end)/i.test(e.align) ? 'r' : 'c';
    if (typeof e.show === 'boolean') e.show = 'always';
    if (e.show && !SHOW.some((s) => s[0] === e.show)) e.show = 'always';
    if (typeof e.bg === 'object' && e.bg) e.bg = e.bg.color || '#1c2840';
    if (Array.isArray(e.grad)) e.grad = e.grad.join(','); if (Array.isArray(e.rgrad)) e.rgrad = e.rgrad.join(','); if (Array.isArray(e.bgrad)) e.bgrad = e.bgrad.join(','); if (Array.isArray(e.tgrad)) e.tgrad = e.tgrad.join(',');
    if (e.t === 'needle' && e.width > 6) e.width = e.width / 3;
    return e;
  }
  function validate(d, warn) {
    warn = warn || [];
    if (d && !d.els && Array.isArray(d.elements)) d.els = d.elements;
    if (d && !d.format && Array.isArray(d.els)) d.format = 'tacho-design';
    if (d && typeof d.bg === 'string') d.bg = { color: d.bg };
    if (d && d.background && !d.bg) d.bg = typeof d.background === 'string' ? { color: d.background } : d.background;
    if (d && Array.isArray(d.els)) d.els = d.els.map((e) => (e && typeof e === 'object' ? normEl(e, warn) : e));
    if (d && typeof d.aspect === 'string') { const m = d.aspect.match(/([\d.]+)\s*[:/x]\s*([\d.]+)/); d.aspect = m ? +m[1] / +m[2] : parseFloat(d.aspect); }
    if (d && Array.isArray(d.els)) {
      const drop = d.els.filter((e) => !e || !TYPES[e.t]);
      if (drop.length) warn.push(drop.length + ' Element(e) mit unbekanntem Typ entfernt: ' + [...new Set(drop.map((e) => e && e.t))].join(', '));
      for (const e of d.els) if (e && TYPES[e.t] && ((+e.x || 0) > 100 || (+e.y || 0) > 100 || (+e.x || 0) + (+e.w || 0) > 110 || (+e.y || 0) + (+e.h || 0) > 110)) { warn.push('Element ' + (e.text || e.src || e.t) + ' liegt außerhalb der Fläche'); if (e.x > 100 || e.y > 100) { e.x = Math.min(e.x, 95); e.y = Math.min(e.y, 95); } }
    }
    if (!d || d.format !== 'tacho-design' || !Array.isArray(d.els)) throw new Error('Das ist keine Tacho-Design-Datei');
    d.name = String(d.name || 'Design').slice(0, 40);
    d.aspect = +d.aspect > 0.3 && +d.aspect < 4 ? +d.aspect : 2;
    d.bg = Object.assign({ color: '#070b12', image: '', fit: 'cover' }, d.bg || {});
    d.warn = warn;
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
  // Nur harmlose Zeichen in Farb- und Verlaufstexten (Dateien können von anderen stammen)
  const csafe = (s) => String(s == null ? '' : s).replace(/[^#0-9a-zA-Z.,%() \-]/g, '').replace(/url/gi, '');
  const stops = (s) => csafe(s).split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
  const hex2 = (h) => { h = String(h).trim(); const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h); if (!m) return [255, 255, 255]; let x = m[1]; if (x.length === 3) x = x.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(x.substr(i, 2), 16)); };
  function gradAt(list, t) {
    const L = list.map(hex2); if (L.length === 1) return `rgb(${L[0]})`;
    const p = Math.max(0, Math.min(0.9999, t)) * (L.length - 1), i = Math.floor(p), k = p - i;
    return 'rgb(' + L[i].map((c, j) => Math.round(c + (L[i + 1][j] - c) * k)).join(',') + ')';
  }
  const lin = (c) => (/gradient/.test(c) ? c : `linear-gradient(${c},${c})`);
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
      // Bis 12 % Abweichung: ganze Fläche füllen statt Rändern (bei geteiltem Bildschirm und anderen Handys)
      if ((opts && opts.fill) || (!(opts && opts.edit) && Math.abs(W / H / d.aspect - 1) <= 0.12)) { w = W; h = H; }
      host.style.background = d.bg.color || '#000';
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.style.setProperty('--u', (h / 100) + 'px'); canvas.style.setProperty('--uw', (w / 100) + 'px');
    }
    layout();
    bg.style.background = d.bg.grad && /^(radial|linear|conic)-gradient\([#0-9a-zA-Z.,%() \-]*\)$/.test(d.bg.grad.trim()) && !/url/i.test(d.bg.grad) ? `${d.bg.grad}, ${csafe(d.bg.color)}` : d.bg.color;
    if (d.bg.image) { bg.style.backgroundImage = `url("${d.bg.image}")`; bg.style.backgroundSize = d.bg.fit === 'fill' ? '100% 100%' : (d.bg.fit || 'cover'); bg.style.backgroundPosition = 'center'; bg.style.backgroundRepeat = 'no-repeat'; }
    host.style.background = d.bg.color;

    const tg = (e) => (e.tgrad ? `;background:linear-gradient(180deg,${stops(e.tgrad).join(',')});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent` : '');
    d.els.forEach((e) => {
      const n = document.createElement('div'); n.className = 'dz-el dz-' + e.t; n.dataset.id = e.id;
      n.style.cssText = `left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;opacity:${e.op};transform:rotate(${e.rot || 0}deg)`;
      let inner = null;
      const fx = [];
      if (e.glow) fx.push(`drop-shadow(0 0 calc(var(--u)*${+e.gs || 1.2}) ${csafe(e.glow)})`);
      if (e.shadow) fx.push('drop-shadow(0 calc(var(--u)*.6) calc(var(--u)*1.1) rgba(0,0,0,.65))');
      if (fx.length) n.style.filter = fx.join(' ');
      const sizeCss = `font-size:calc(var(--u)*${e.size || 6});color:${e.color};font-family:${FONTS[e.font] || FONTS.sans};font-weight:${e.weight || 600};justify-content:${e.align === 'l' ? 'flex-start' : e.align === 'r' ? 'flex-end' : 'center'}`;
      switch (e.t) {
        case 'text': n.style.cssText += ';' + sizeCss + tg(e); n.textContent = e.text; break;
        case 'value': n.style.cssText += ';' + sizeCss + tg(e); n.innerHTML = '<span class="v"></span>' + (e.unit ? `<small>${esc(e.unit)}</small>` : ''); inner = n.querySelector('.v'); break;
        case 'road': n.style.cssText += ';' + sizeCss; n.innerHTML = '<span class="v"></span>'; inner = n.querySelector('.v'); break;
        case 'rect': {
          const fill = e.rgrad ? `radial-gradient(circle at 35% 25%,${stops(e.rgrad).join(',')})` : e.grad ? `linear-gradient(${+e.gang || 180}deg,${stops(e.grad).join(',')})` : e.color;
          n.style.borderRadius = e.shape === 'circle' ? '50%' : e.radius + '%';
          if (e.border && e.bgrad) {
            const conic = e.bmode !== 'linear';
            n.style.border = `calc(var(--u)*${e.border}) solid transparent`;
            n.style.background = `${lin(fill)} padding-box, ${conic ? `conic-gradient(from ${+e.bang || 0}deg,${stops(e.bgrad).join(',')})` : `linear-gradient(${+e.bang || 135}deg,${stops(e.bgrad).join(',')})`} border-box`;
          } else { n.style.background = fill; if (e.border) n.style.border = `calc(var(--u)*${e.border}) solid ${e.borderColor}`; }
          const sh = [];
          if (e.inner) sh.push(`inset 0 0 calc(var(--u)*${+e.ins || 3}) ${csafe(e.inner)}`);
          if (e.rglow) sh.push(`0 0 calc(var(--u)*${+e.rgs || 2}) ${csafe(e.rglow)}`);
          if (e.drop) sh.push('0 calc(var(--u)*.8) calc(var(--u)*2) rgba(0,0,0,.6)');
          if (sh.length) n.style.boxShadow = sh.join(',');
          if (e.shine) { const s = document.createElement('i'); s.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,${+e.shine}) 0%,rgba(255,255,255,0) 48%)`; n.appendChild(s); }
          break;
        }
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
            if (e.grad) {
              const st = stops(e.grad), N = e.n || 64, span = e.a1 - e.a0; let p = '';
              for (let i = 0; i < N; i++) { const a = e.a0 + span * i / N, b = e.a0 + span * (i + 0.86) / N; p += `<path class="s" d="${arcPath(50, 50, r, a, b)}" fill="none" stroke="${gradAt(st, (i + 0.5) / N)}" stroke-width="${e.thick}"/>`; }
              svg.innerHTML = `<path d="${arcPath(50, 50, r, e.a0, e.a1)}" fill="none" stroke="${e.bg}" stroke-width="${e.thick + 1}" stroke-linecap="round" opacity=".55"/><g class="gs">${p}</g>`;
            } else
            svg.innerHTML = `<path d="${arcPath(50, 50, r, e.a0, e.a1)}" fill="none" stroke="${e.bg}" stroke-width="${e.thick}" stroke-linecap="round"/><path class="a" d="${arcPath(50, 50, r, e.a0, e.a0 + 0.01)}" fill="none" stroke="${e.color}" stroke-width="${e.thick}" stroke-linecap="round"/>`;
          } else if (e.t === 'needle') {
            const tip = 50 - 50 * e.len / 100, hw = e.width * 0.8, tail = e.tail == null ? 7 : e.tail;
            const body = e.style === 'line' ? `<line x1="50" y1="${50 + tail}" x2="50" y2="${tip}" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round"/>`
              : `<path d="M${50 - hw} ${50 + tail * 0.6}L${50 - hw * 0.28} ${tip + 2}L50 ${tip}L${50 + hw * 0.28} ${tip + 2}L${50 + hw} ${50 + tail * 0.6}Z" fill="${e.color}"/>`;
            const hub = e.hub ? `<defs><radialGradient id="hg${e.id}" cx="35%" cy="30%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9aa6b8"/><stop offset="1" stop-color="#2a3140"/></radialGradient></defs><circle cx="50" cy="50" r="${e.width * 2.4}" fill="url(#hg${e.id})" stroke="#0b0f18" stroke-width=".6"/><circle cx="50" cy="50" r="${e.width * 0.9}" fill="${e.color}"/>` : '';
            svg.innerHTML = `<g class="g">${body}</g>${hub}`;
          } else {
            let g = ''; const total = Math.max(1, Math.round((e.max - e.min) / e.step));
            for (let i = 0; i <= total; i++) {
              const a = e.a0 + (e.a1 - e.a0) * i / total, [x0, y0] = pol(50, 50, 47, a), [x1, y1] = pol(50, 50, 40, a), [tx, ty] = pol(50, 50, 31, a);
 const val = e.min + (e.max - e.min) * i / total, cc = e.red != null && val >= e.red ? (e.redColor || '#ff3b30') : e.color;
              g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${cc}" stroke-width="1.3" stroke-linecap="round"/>`;
              g += `<text x="${tx}" y="${ty}" fill="${cc}" font-style="${e.italic ? 'italic' : 'normal'}" font-size="${e.size * 2.2}" text-anchor="middle" dominant-baseline="central" font-family="${FONTS[e.font] || FONTS.sans}" font-weight="600">${Math.round(e.min + (e.max - e.min) * i / total)}</text>`;
              if (i < total) for (let k = 1; k <= e.minor; k++) { const a2 = a + (e.a1 - e.a0) / total * k / (e.minor + 1), [m0, n0] = pol(50, 50, 47, a2), [m1, n1] = pol(50, 50, 43.5, a2); g += `<line x1="${m0}" y1="${n0}" x2="${m1}" y2="${n1}" stroke="${e.red != null && e.min + (e.max - e.min) * (i + k / (e.minor + 1)) / total >= e.red ? (e.redColor || '#ff3b30') : e.color}" stroke-opacity=".7" stroke-width=".6"/>`; }
            }
            if (e.band) for (const [f0, f1, c] of e.band) g += `<path d="${arcPath(50, 50, 49, e.a0 + (e.a1 - e.a0) * frac(f0, e.min, e.max), e.a0 + (e.a1 - e.a0) * frac(f1, e.min, e.max))}" fill="none" stroke="${csafe(c)}" stroke-width="1.8"/>`;
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
          case 'arc': if (e.grad) { const v = api.get(e.src), N = e.n || 64, f = frac(v.n == null ? 0 : v.n, e.min, e.max) * N, ss = n.querySelectorAll('.s'), dim = e.dim == null ? 0.16 : e.dim; for (let i = 0; i < ss.length; i++) ss[i].setAttribute('opacity', i + 1 <= f ? 1 : (i < f ? dim + (1 - dim) * (f - i) : dim)); break; } { const v = api.get(e.src), a = e.a0 + (e.a1 - e.a0) * frac(v.n == null ? 0 : v.n, e.min, e.max); n.querySelector('.a').setAttribute('d', arcPath(50, 50, 50 - e.thick / 2, e.a0, Math.max(e.a0 + 0.01, a))); n.querySelector('.a').setAttribute('stroke', col === 'var(--st)' ? getComputedStyle(document.body).getPropertyValue('--st') || e.color : col); break; }
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
    t = t.replace(/\/\/[^\n"]*$/gm, '').replace(/,\s*([}\]])/g, '$1');
    return validate(JSON.parse(t), []);
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
