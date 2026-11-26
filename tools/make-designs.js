// Erzeugt die Beispiel-Designs im Ordner designs/. Aufruf: node tools/make-designs.js
// Dasselbe Format kann man von Hand oder mit eigenen Skripten schreiben (siehe DESIGN-FORMAT.md).
const fs = require('fs'), path = require('path');
const D = require('../www/design.js');
let n = 0;
const el = (t, o) => Object.assign({ id: 'e' + (n++), t, x: 0, y: 0, rot: 0, op: 1, show: 'always' }, JSON.parse(JSON.stringify(D.DEFAULTS[t])), o);
const out = (d) => {
  const v = D.validate(d);
  fs.mkdirSync(path.join(__dirname, '..', 'designs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'designs', v.name.replace(/\s+/g, '-') + '.tacho.json'), JSON.stringify(v));
  console.log('geschrieben:', v.name, v.els.length, 'Elemente');
};

// 1) Rundinstrument quer: Nadel-Tacho in der Mitte, Werte links und rechts
(() => {
  const d = D.blank('Rundinstrument'); d.aspect = 2.1667; d.bg.color = '#06090f';
  const cx = 50, size = 92, w = size / 2.1667; // Kreis quadratisch: Breite in % = Höhe% / Aspekt
  d.els.push(
    el('rect', { x: 50 - w / 2 - 1, y: 3, w: w + 2, h: 94, color: '#0b111b', radius: 50, border: 0.8, borderColor: '#1c2840' }),
    el('arc', { x: 50 - w / 2, y: 4, w, h: 92, src: 'kmh', min: 0, max: 240, a0: -135, a1: 135, thick: 4.5, color: '#3ddc97', bg: '#141c2b', stc: true }),
    el('dial', { x: 50 - w / 2 + 2.2, y: 8, w: w - 4.4, h: 84, min: 0, max: 240, step: 20, minor: 3, a0: -135, a1: 135, color: '#cfd8e6', size: 3.1 }),
    el('needle', { x: 50 - w / 2, y: 4, w, h: 92, src: 'kmh', min: 0, max: 240, a0: -135, a1: 135, len: 82, width: 1.4, color: '#ff3b30' }),
    el('value', { x: 50 - 12, y: 51, w: 24, h: 16, src: 'speed', size: 14, weight: 800, stc: true }),
    el('text', { x: 50 - 8, y: 66, w: 16, h: 5, text: 'KM/H', size: 2.8, color: '#7c8aa0', weight: 600 }),
    el('sign', { x: 50 - 3.5, y: 71.5, w: 7, h: 15 }),
    el('road', { x: 50 - 14, y: 89, w: 28, h: 6, size: 3.4, color: '#cfd8e6', align: 'c' }),
    // links
    el('text', { x: 4, y: 12, w: 20, h: 5, text: 'HÖHE', size: 3, color: '#7c8aa0', align: 'l' }),
    el('value', { x: 4, y: 17, w: 20, h: 12, src: 'alt', unit: 'm', size: 9, align: 'l' }),
    el('text', { x: 4, y: 38, w: 20, h: 5, text: 'RICHTUNG', size: 3, color: '#7c8aa0', align: 'l' }),
    el('value', { x: 4, y: 43, w: 20, h: 12, src: 'dirname', size: 9, align: 'l' }),
    el('text', { x: 4, y: 64, w: 20, h: 5, text: 'GESAMT', size: 3, color: '#7c8aa0', align: 'l' }),
    el('value', { x: 4, y: 69, w: 22, h: 10, src: 'total', unit: 'km', size: 7, align: 'l' }),
    // rechts
    el('text', { x: 76, y: 12, w: 20, h: 5, text: 'UHRZEIT', size: 3, color: '#7c8aa0', align: 'r' }),
    el('value', { x: 72, y: 17, w: 24, h: 12, src: 'clock', size: 9, align: 'r' }),
    el('text', { x: 76, y: 38, w: 20, h: 5, text: 'TRIP', size: 3, color: '#7c8aa0', align: 'r' }),
    el('value', { x: 70, y: 43, w: 26, h: 12, src: 'trip', dec: 1, unit: 'km', size: 9, align: 'r' }),
    el('text', { x: 76, y: 64, w: 20, h: 5, text: 'HÖCHSTTEMPO', size: 3, color: '#7c8aa0', align: 'r' }),
    el('value', { x: 70, y: 69, w: 26, h: 10, src: 'max', unit: 'km/h', size: 7, align: 'r' }),
    el('next', { x: 76, y: 86, w: 22, h: 9, size: 3.6 })
  );
  out(d);
})();

// 2) Sport-Balken quer: riesiges Tempo, Segment-Balken oben
(() => {
  const d = D.blank('Sport Balken'); d.aspect = 2.1667; d.bg.color = '#0a0508';
  d.els.push(
    el('bar', { x: 3, y: 5, w: 94, h: 9, src: 'kmh', min: 0, max: 240, color: '#ff5a1f', bg: '#1c0f12', radius: 4, segs: 40, stc: false, limitMark: false }),
    el('value', { x: 3, y: 15, w: 20, h: 8, src: 'max', unit: ' km/h max', size: 5, color: '#ff9a6b', align: 'l', weight: 600 }),
    el('value', { x: 22, y: 18, w: 56, h: 62, src: 'speed', size: 52, weight: 900, font: 'condensed', align: 'c', stc: true, pad: 0 }),
    el('text', { x: 72, y: 66, w: 12, h: 8, text: 'km/h', size: 5, color: '#7c8aa0', align: 'l' }),
    el('sign', { x: 3, y: 22, w: 17, h: 38 }),
    el('next', { x: 3, y: 64, w: 22, h: 10, size: 4 }),
    el('road', { x: 3, y: 76, w: 40, h: 7, size: 4, color: '#cfd8e6', align: 'l' }),
    el('bar', { x: 3, y: 86, w: 94, h: 9, src: 'speed', min: 0, max: 240, color: '#3ddc97', bg: '#141c2b', radius: 4, segs: 48, stc: true, limitMark: true }),
    el('value', { x: 78, y: 18, w: 19, h: 9, src: 'alt', unit: 'm', size: 6, align: 'r' }),
    el('value', { x: 78, y: 30, w: 19, h: 9, src: 'clock', size: 6, align: 'r' }),
    el('value', { x: 78, y: 42, w: 19, h: 9, src: 'trip', dec: 1, unit: 'km', size: 6, align: 'r' })
  );
  out(d);
})();

// 3) Cockpit hochkant: Rundinstrument oben, Werte unten
(() => {
  const d = D.blank('Cockpit Hochkant'); d.aspect = 0.4615; d.orient = 'port'; d.bg.color = '#06090f';
  const asp = 0.4615, wC = 92, hC = wC * asp * 0.4615 / 0.4615; // Quadrat: Höhe% = Breite% * Aspekt^-1 -> h = w / ... siehe unten
  const hSq = wC * asp; // Höhe in % bei Breite wC% (Quadrat)
  d.els.push(
    el('arc', { x: 4, y: 6, w: wC, h: hSq, src: 'kmh', min: 0, max: 240, a0: -135, a1: 135, thick: 5, color: '#3ddc97', bg: '#141c2b', stc: true }),
    el('dial', { x: 8, y: 6 + 4 * asp, w: wC - 8, h: hSq - 8 * asp, min: 0, max: 240, step: 20, minor: 3, a0: -135, a1: 135, color: '#cfd8e6', size: 2.2 }),
    el('needle', { x: 4, y: 6, w: wC, h: hSq, src: 'kmh', min: 0, max: 240, a0: -135, a1: 135, len: 82, width: 1.6, color: '#ff3b30' }),
    el('value', { x: 25, y: 6 + hSq * 0.50, w: 50, h: 9, src: 'speed', size: 9, weight: 800, stc: true }),
    el('sign', { x: 50 - 8.5, y: 6 + hSq * 0.69, w: 17, h: 17 * 0.4615 }),
    el('road', { x: 10, y: 6 + hSq + 0.5, w: 80, h: 3.5, size: 2.2, align: 'c', color: '#cfd8e6' }),
    el('next', { x: 30, y: 6 + hSq + 4.5, w: 40, h: 4.5, size: 2.4 }),
    el('bar', { x: 5, y: 58, w: 90, h: 2.5, src: 'speed', min: 0, max: 240, color: '#3ddc97', bg: '#141c2b', radius: 6, segs: 30, stc: true, limitMark: true }),
    el('text', { x: 6, y: 62, w: 40, h: 3, text: 'HÖHE', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 6, y: 65, w: 40, h: 6, src: 'alt', unit: 'm', size: 4.6, align: 'l' }),
    el('text', { x: 54, y: 62, w: 40, h: 3, text: 'UHRZEIT', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 54, y: 65, w: 40, h: 6, src: 'clock', size: 4.6, align: 'l' }),
    el('text', { x: 6, y: 75, w: 40, h: 3, text: 'TAGESKM', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 6, y: 78, w: 40, h: 6, src: 'day', dec: 1, unit: 'km', size: 4.6, align: 'l' }),
    el('text', { x: 54, y: 75, w: 40, h: 3, text: 'GESAMT', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 54, y: 78, w: 42, h: 6, src: 'total', unit: 'km', size: 4.6, align: 'l' }),
    el('text', { x: 6, y: 88, w: 40, h: 3, text: 'RICHTUNG', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 6, y: 91, w: 40, h: 6, src: 'dirname', size: 4.6, align: 'l' }),
    el('text', { x: 54, y: 88, w: 40, h: 3, text: 'HÖCHSTTEMPO', size: 1.8, color: '#7c8aa0', align: 'l' }), el('value', { x: 54, y: 91, w: 42, h: 6, src: 'max', unit: 'km/h', size: 4.6, align: 'l' })
  );
  out(d);
})();

// 4) Renn-Cockpit quer: Rundinstrument links mit Tempo-Leiste, riesiges Tempo, Werte-Kacheln, Tempo-Schild
(() => {
  const d = D.blank('Renn Cockpit'); d.aspect = 2.1667; d.bg.color = '#02030a';
  d.bg.grad = 'radial-gradient(ellipse at 30% 40%,#0c1a3a 0%,#050a18 55%,#02030a 100%)';
  const gh = 82, gw = gh / 2.1667, gx = 2, gy = 14;
  d.els.push(
    el('bar', { x: 22, y: 3, w: 56, h: 5.5, src: 'kmh', min: 0, max: 240, color: '#ff4a1c', grad: '#2bd96b,#a6e22e,#ffd23c,#ff7a1c,#ff2b1c', bg: '#12182a', radius: 30, segs: 24, stc: false, limitMark: false }),
    el('rect', { x: gx - 0.9, y: gy - 1.9, w: gw + 1.8, h: gh + 3.8, shape: 'circle', color: '#050a18', rgrad: '#16346a,#07122a', border: 1.6, bgrad: '#f4f7fb,#6b7380,#dfe4ec,#3f4552,#f4f7fb,#6b7380,#dfe4ec,#3f4552,#f4f7fb', drop: true, inner: '#2a6bff55', ins: 4 }),
    el('arc', { x: gx + 1.9, y: gy + 4, w: gw - 3.8, h: gh - 8, src: 'kmh', min: 0, max: 240, a0: -130, a1: 110, thick: 5.5, color: '#2f8bff', grad: '#1e7bff,#00d0ff,#3cff9a,#ffd23c,#ff7a1c,#ff2b1c', bg: '#0f1a33', glow: '#2a8bff', gs: 0.9, dim: 0.14 }),
    el('dial', { x: gx + 3.4, y: gy + 7, w: gw - 6.8, h: gh - 14, min: 0, max: 240, step: 20, minor: 4, a0: -130, a1: 110, color: '#e4eeff', size: 2.6, lim: false, red: 200, band: [[200, 240, '#ff3b30']], italic: true }),
    el('needle', { x: gx + 1.9, y: gy + 4, w: gw - 3.8, h: gh - 8, src: 'kmh', min: 0, max: 240, a0: -130, a1: 110, len: 80, width: 1.7, color: '#ff4030', glow: '#ff3b2e', gs: 0.8, hub: true, tail: 9 }),
    el('value', { x: gx + 5, y: gy + 40, w: gw - 10, h: 15, src: 'max', size: 11, weight: 800, font: 'condensed', color: '#ffffff', tgrad: '#ffffff,#a9d4ff', glow: '#2a8bff', gs: 0.7 }),
    el('text', { x: gx + 8, y: gy + 55, w: gw - 16, h: 5, text: 'MAX KM/H', size: 2.8, color: '#7f93bd', weight: 700 }),
    el('value', { x: gx + 8, y: gy + 63, w: gw - 16, h: 9, src: 'dirname', size: 6, color: '#7f93bd', weight: 700 }),
    el('value', { x: 44, y: 11, w: 36, h: 42, src: 'speed', size: 40, weight: 900, font: 'condensed', stc: true, align: 'c', glow: '#2a8bff', gs: 0.8, shadow: true }),
    el('text', { x: 62, y: 49, w: 18, h: 6, text: 'KM/H', size: 3.6, color: '#7f93bd', weight: 700, align: 'r' }),
    el('sign', { x: 82, y: 11, w: 16, h: 38 })
  );
  const box = (x, y, label, src, unit, dec, w) => {
    w = w || 16;
    d.els.push(
      el('rect', { x, y, w, h: 19, grad: '#14264a,#081226', gang: 160, radius: 8, border: 0.5, bgrad: '#4a78c8,#1a2c52', bmode: 'linear', bang: 160, shine: 0.07, drop: true }),
      el('text', { x, y: y + 1.5, w, h: 5, text: label, size: 3, color: '#8aa2d0', weight: 700 }),
      el('value', { x, y: y + 6.5, w, h: 11, src, unit, dec: dec || 0, size: 8, weight: 800, font: 'condensed', tgrad: '#ffffff,#b8d6ff' })
    );
  };
  box(44, 57, 'FEUCHTE', 'hum', '%'); box(63, 57, 'AUSSEN', 'temp', '°C'); box(82, 57, 'SATELLITEN', 'sat', '');
  box(44, 78, 'TRIP', 'trip', 'km', 1, 22); box(68, 78, 'GESAMT', 'total', 'km', 0, 22);
  d.els.push(el('value', { x: 2, y: 1.5, w: 17, h: 9, src: 'clock', size: 6, weight: 800, font: 'condensed', align: 'l', color: '#9fb4e0' }));
  out(d);
})();

// 5) Fahr-Tacho Voll: Vorlage nach Kundenbild, volle Breite quer (Kopfzeile, drei Spalten)
(() => {
  const d = D.blank('Fahr-Tacho Voll'); d.aspect = 2.1667; d.bg.color = '#050a14'; d.bg.grad = 'radial-gradient(ellipse at 50% 35%,#13243f 0%,#0a1424 55%,#050a14 100%)';
  const svg = (b) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + b + '</svg>');
  const ICON = {
    bat: svg('<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>'),
    alt: svg('<path d="M2 20l7-12 4 7 3-4 6 9z" fill="#38bdf8"/>'),
    clk: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    sat: svg('<path d="M4 14l6 6M9 9l6 6M13 5l6 6M3 21l4-4M8 5l3-3 4 4-3 3zM14 12l3-3 4 4-3 3z"/>')
  };
  const col = [['#101826', '#1d2b44'], ['#0e1522', '#1d2b44']];
  const tile = (x, y, w, h, lab, src, unit, o) => {
    o = o || {};
    d.els.push(el('rect', o.green ? { x, y, w, h, grad: '#17502f,#0b2a19', gang: 160, radius: 8, border: 0.9, bgrad: '#4ade80,#16a34a', bmode: 'linear', bang: 160, rglow: '#22c55e55', rgs: 1.5, shine: 0.08 } : { x, y, w, h, grad: '#18284a,#0b1426', gang: 160, radius: 8, border: 0.6, bgrad: '#4a78c8,#1b2c52', bmode: 'linear', bang: 160, shine: 0.07, drop: true }));
    d.els.push(el('text', { x, y: y + 1, w, h: 4.8, text: lab, size: o.ls || 3.3, color: o.lc || '#aab6c9', weight: 600, align: 'c' }));
    d.els.push(el('value', { x: x + (o.icon ? 4 : 0), y: y + (o.vy || 5.8), w: w - (o.icon ? 4 : 0), h: o.vh || 7.2, src, unit, dec: o.dec || 0, size: o.vs || 5.4, weight: 800, font: 'condensed', color: o.vc || '#ffffff', tgrad: o.vc ? '' : '#ffffff,#b8d6ff', glow: o.vc, gs: 0.5, align: 'c' }));
    if (o.icon) d.els.push(el('image', { x: x + 1.2, y: y + (o.vy || 5.8) + 0.3, w: 3.2, h: 6.5, img: ICON[o.icon], fit: 'contain' }));
  };
  // Kopfzeile
  d.els.push(
    el('rect', { x: 1.2, y: 2, w: 97.6, h: 15, grad: '#1b2c4e,#0a1325', gang: 180, radius: 14, border: 0.8, bgrad: '#5a86d8,#1c2e56', bmode: 'linear', bang: 90, shine: 0.08, drop: true }),
    el('road', { x: 2.6, y: 3.5, w: 27, h: 12, size: 6.6, color: '#ffffff', weight: 800, font: 'condensed', align: 'l' }),
    el('sign', { x: 31, y: 3.3, w: 6.6, h: 12.6 }),
    el('next', { x: 39, y: 3.3, w: 17, h: 12.6, size: 3.2 }),
    el('value', { x: 56, y: 3, w: 22, h: 13.5, src: 'clock', size: 9, weight: 800, font: 'condensed', color: '#38bdf8', align: 'r' })
  );
  // Mitte
  d.els.push(
    el('rect', { x: 25.8, y: 20, w: 48.4, h: 78, grad: '#14233f,#080f1d', gang: 165, radius: 10, border: 0.7, bgrad: '#4a78c8,#1b2c52', bmode: 'linear', bang: 160, shine: 0.05, drop: true, inner: '#2a6bff33', ins: 5 }),
    el('value', { x: 27.5, y: 22, w: 14, h: 8, src: 'dirname', size: 6.2, weight: 800, color: '#38bdf8', align: 'l' }),
    el('value', { x: 27.5, y: 30, w: 14, h: 6, src: 'dir', unit: '°', size: 4, weight: 700, color: '#38bdf8', align: 'l' }),
    el('value', { x: 59, y: 24, w: 13.5, h: 8, src: 'temp', unit: '°C', size: 5.6, weight: 800, color: '#e8eefb', align: 'r' }),
    el('value', { x: 28, y: 33, w: 44, h: 38, src: 'speed', size: 31, weight: 900, font: 'condensed', color: '#ffffff', tgrad: '#ffffff,#8fc8ff', glow: '#2a8bff', gs: 0.9, shadow: true, align: 'c' }),
    el('text', { x: 28, y: 69, w: 44, h: 6.5, text: 'km/h', size: 4.8, color: '#cbd5e1', weight: 600 }),
    el('bar', { x: 28.5, y: 77.5, w: 43, h: 4.2, src: 'speed', min: 0, max: 240, color: '#22c55e', grad: '#22c55e,#facc15,#ef4444', bg: '#1a2436', radius: 50, segs: 0, stc: false, limitMark: true, glow: '#3ddc97', gs: 0.5 }),
    el('text', { x: 28, y: 83, w: 44, h: 5, text: 'MAX Tempo', size: 3.6, color: '#ff9f5a', weight: 700 }),
    el('value', { x: 28, y: 88, w: 44, h: 9, src: 'max', unit: ' km/h', size: 6.2, weight: 800, font: 'condensed', color: '#ff7a3d', align: 'c' })
  );
  // Links
  const lx = 1.2, lw = 23;
  d.els.push(
    el('rect', { x: lx, y: 20, w: lw, h: 33, grad: '#18284a,#0b1426', gang: 160, radius: 8, border: 0.6, bgrad: '#4a78c8,#1b2c52', bmode: 'linear', bang: 160, shine: 0.07, drop: true }),
    el('text', { x: lx, y: 21, w: lw, h: 5, text: 'G-Kraft', size: 3.6, color: '#cbd5e1', weight: 600 }),
    el('arc', { x: lx + (lw - 8.4) / 2, y: 26.5, w: 8.4, h: 18.2, src: 'g', min: 0, max: 1.5, a0: -135, a1: 135, thick: 7, color: '#ef4444', grad: '#38bdf8,#3cff9a,#ffd23c,#ef4444', bg: '#1b2638', stc: false, glow: '#38bdf8', gs: 0.6 }),
    el('value', { x: lx, y: 45.5, w: lw, h: 6.5, src: 'g', dec: 1, unit: ' G', size: 5.2, weight: 800, font: 'condensed', color: '#ffffff' })
  );
  tile(lx, 55, lw, 14, 'Höhe', 'alt', ' m', { icon: 'alt', vs: 5.6 });
  tile(lx, 71, lw, 13.5, 'Beschleunigung', 'acc', ' m/s²', { green: true, lc: '#86efac', vc: '#4ade80', dec: 1, ls: 3 });
  tile(lx, 86.5, lw, 11.5, 'Fahrzeit', 'time', ' h', { icon: 'clk', vs: 5, vy: 5, vh: 6, ls: 3 });
  // Rechts
  const rx = 75, rw = 23.8;
  const rh = 11.6, rv = { vy: 5, vh: 6, vs: 5, ls: 3 };
  tile(rx, 20, rw, rh, 'Satelliten', 'sat', '', Object.assign({ dec: 0 }, rv));
  tile(rx, 33, rw, rh, 'Tageskilometer', 'day', ' km', Object.assign({ dec: 1, vc: '#38bdf8', lc: '#7aa7d9' }, rv));
  tile(rx, 46, rw, rh, 'Trip-Strecke', 'trip', ' km', Object.assign({ dec: 1 }, rv));
  tile(rx, 59, rw, rh, 'Gesamtkilometer', 'total', ' km', rv);
  tile(rx, 72, rw, rh, 'Satelliten', 'sat', ' SAT', Object.assign({ icon: 'sat', vc: '#38bdf8' }, rv));
  out(d);
})();

// 6) Cockpit RGB: zwei Rundinstrumente mit Metallring, gelbe Mittelscheiben, RGB-Rahmen (realistischer Auto-Look)
(() => {
  const d = D.blank('Cockpit RGB'); d.aspect = 2.1667; d.bg.color = '#020409';
  d.bg.grad = 'radial-gradient(ellipse at 50% 60%,#0d2146 0%,#060d1e 55%,#020409 100%)';
  const RGB = '#ff2bd6,#7a3cff,#2b8cff,#00e5ff,#2bff7a,#ffe92b,#ff9a2b,#ff2b4a,#ff2bd6';
  const METAL = '#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb';
  d.els.push(el('rect', { x: 0.8, y: 1.5, w: 98.4, h: 97, grad: '#0a1226,#03060e', gang: 180, radius: 12, border: 1.3, bgrad: RGB, bmode: 'conic', rglow: '#7a5cff66', rgs: 2.2 }));
  const gh = 78, gw = gh / 2.1667, gy = 9;
  const gauge = (gx, o) => {
    d.els.push(
      el('rect', { x: gx - 0.8, y: gy - 1.7, w: gw + 1.6, h: gh + 3.4, shape: 'circle', rgrad: '#173a78,#08142c', color: '#08142c', border: 2.2, bgrad: METAL, drop: true, inner: '#2f7bff66', ins: 5 }),
      el('arc', { x: gx + 1.8, y: gy + 3.8, w: gw - 3.6, h: gh - 7.6, src: o.src, min: o.min, max: o.max, a0: -130, a1: 130, thick: 6, color: '#2f8bff', grad: o.grad, bg: '#0f1a33', glow: o.glow, gs: 1, dim: 0.16 }),
      el('dial', { x: gx + 3.4, y: gy + 6.8, w: gw - 6.8, h: gh - 13.6, min: o.dmin, max: o.dmax, step: o.step, minor: o.minor, a0: -130, a1: 130, color: '#e8f1ff', size: o.ls || 3.1, lim: !!o.lim, red: o.red, band: o.band, italic: true }),
      el('needle', { x: gx + 1.8, y: gy + 3.8, w: gw - 3.6, h: gh - 7.6, src: o.src, min: o.min, max: o.max, a0: -130, a1: 130, len: 82, width: 1.6, color: '#ff4030', glow: '#ff3b2e', gs: 0.7, hub: false, tail: 10, shadow: true }),
      el('rect', { x: gx + gw * 0.5 - gw * 0.21, y: gy + gh * 0.5 - gh * 0.21, w: gw * 0.42, h: gh * 0.42, shape: 'circle', rgrad: '#fff6a0,#ffd400,#b88a00', color: '#ffd400', border: 0.6, borderColor: '#fff7b8', rglow: '#ffd40088', rgs: 2.6, inner: '#ffffffaa', ins: 1.6, shine: 0.42, drop: true }),
      el('text', { x: gx + gw * 0.3, y: gy + gh * 0.5 - gh * 0.18, w: gw * 0.4, h: 6, text: o.lab, size: 2.9, color: '#3a2a00', weight: 800, font: 'condensed' }),
      el('value', { x: gx + gw * 0.27, y: gy + gh * 0.5 - gh * 0.1, w: gw * 0.46, h: 13, src: o.vs, size: o.vsz, weight: 900, font: 'condensed', color: '#1a1200', align: 'c' }),
      el('value', { x: gx + gw * 0.3, y: gy + gh * 0.5 + gh * 0.08, w: gw * 0.4, h: 7, src: o.s2, unit: o.u2, dec: o.d2 || 0, size: 3.8, weight: 800, font: 'condensed', color: '#2a1d00' }),
      el('rect', { x: gx, y: gy, w: gw, h: gh, shape: 'circle', color: 'transparent', shine: 0.1, border: 0 })
    );
  };
  gauge(3.8, { src: 'wind', min: 0, max: 100, grad: '#1e7bff,#00d0ff,#3cff9a,#ffd23c,#ff7a1c,#ff2b1c', glow: '#2a8bff', dmin: 0, dmax: 100, step: 10, minor: 4, red: 80, band: [[80, 100, '#ff3b30']], lab: 'WIND', vs: 'wind', vsz: 8.6, s2: 'time', u2: ' MIN' });
  gauge(100 - 3.8 - gw, { src: 'kmh', min: 0, max: 240, grad: '#00d0ff,#1e90ff,#3cff9a,#ffd23c,#ff7a1c,#ff2b1c', glow: '#2a8bff', dmin: 0, dmax: 240, step: 20, minor: 3, red: 200, band: [[200, 240, '#ff3b30']], ls: 2.5, lim: true, lab: 'KM/H', vs: 'speed', vsz: 10, s2: 'trip', u2: ' km', d2: 1 });
  const cx = 40.6, cw = 18.8;
  d.els.push(
    el('value', { x: cx, y: 12, w: cw, h: 6, src: 'date', size: 3, color: '#cfe0ff', weight: 700, font: 'condensed' }),
    el('value', { x: cx, y: 19, w: cw, h: 12, src: 'clock', size: 9, color: '#ffffff', tgrad: '#ffffff,#9fd0ff', glow: '#2a8bff', gs: 0.6, weight: 800, font: 'condensed' }),
    el('value', { x: cx, y: 33, w: cw, h: 8, src: 'dirname', size: 5.4, color: '#ffffff', weight: 800 }),
    el('needle', { x: cx + cw / 2 - 2.2, y: 41, w: 4.4, h: 9.5, src: 'dir', min: 0, max: 360, a0: 0, a1: 360, len: 46, width: 6, color: '#ff3b30', glow: '#ff3b30', gs: 0.4, hub: false, tail: 0 }),
    el('sign', { x: cx + cw / 2 - 5, y: 52, w: 10, h: 21 }),
    el('road', { x: cx, y: 74, w: cw, h: 6, size: 3, color: '#cfe0ff', align: 'c', weight: 700 }),
    el('next', { x: cx + 2, y: 81, w: cw - 4, h: 10, size: 3 }),
    el('value', { x: 5, y: 90, w: 14, h: 6, src: 'temp', unit: '°C', size: 4, color: '#38bdf8', weight: 800, font: 'condensed', align: 'l' }),
    el('value', { x: 77, y: 90, w: 12, h: 6, src: 'hum', unit: ' %', dec: 0, size: 4, color: '#38bdf8', weight: 800, font: 'condensed', align: 'r' })
  );
  out(d);
})();

// 7) HUD Hochkant geteilt: Vorlage nach KI-Bild (blaue HUD-Optik), Fläche 0.4977 (1218x2447 px, obere/untere Hälfte)
(() => {
  const d = D.blank('HUD Hochkant Split'); d.aspect = 0.4977; d.orient = 'port'; d.bg.color = '#02060f';
  d.bg.grad = 'radial-gradient(ellipse at 50% 30%,#0b2a5a 0%,#04102a 55%,#02060f 100%)';
  const CY = '#38d5ff', GL = '#1e8bff';
  // Rahmen und Kopf
  d.els.push(
    el('rect', { x: 1.5, y: 1.5, w: 97, h: 97, grad: '#0a1a33,#030812', gang: 180, radius: 6, border: 0.5, bgrad: CY + ',' + GL + ',' + CY, bmode: 'linear', bang: 160, rglow: '#1e8bff55', rgs: 1.2 }),
    el('text', { x: 5, y: 3.5, w: 60, h: 4, text: 'HUD · TACHO', size: 2.4, color: CY, weight: 800, font: 'mono' }),
    el('value', { x: 60, y: 3.2, w: 35, h: 4.4, src: 'clock', size: 2.8, color: '#dff6ff', weight: 800, font: 'mono', align: 'r', glow: CY, gs: 0.6 }),
    el('road', { x: 5, y: 8, w: 62, h: 4, size: 3.2, color: '#ffffff', weight: 800, align: 'l' }),
    el('sign', { x: 72, y: 6.5, w: 22, h: 9.5 })
  );
  // Globus-Ersatz: Bogen mit Punktreihen, dann Tempo-Anzeige
  d.els.push(
    el('rect', { x: 14, y: 17, w: 72, h: 33.5, shape: 'circle', rgrad: '#1d5bd0,#071a44,#02060f', color: '#071a44', border: 0.9, bgrad: CY + ',' + GL + ',' + CY, bmode: 'conic', rglow: '#2b9bff88', rgs: 2 }),
    el('arc', { x: 16, y: 19, w: 68, h: 29.5, src: 'kmh', min: 0, max: 240, a0: -130, a1: 130, thick: 3.5, grad: '#38d5ff,#3cff9a,#ffd23c,#ff2b1c', bg: '#0b2140', glow: CY, gs: 0.9, dim: 0.18 }),
    el('needle', { x: 16, y: 19, w: 68, h: 29.5, src: 'kmh', min: 0, max: 240, a0: -130, a1: 130, len: 84, width: 1.1, tail: 8, color: '#ffffff', glow: CY, gs: 0.8 }),
    el('value', { x: 22, y: 32, w: 56, h: 11, src: 'speed', size: 9.5, weight: 900, font: 'condensed', color: '#ffffff', tgrad: '#ffffff,#9fe9ff', glow: CY, gs: 0.9, align: 'c', shadow: true }),
    el('text', { x: 30, y: 44, w: 40, h: 3, text: 'KM/H', size: 2.4, color: '#7fd8ff', weight: 700, align: 'c' })
  );
  // Linke Spalte: Balken-Reihe wie im Bild
  const bar = (y, lab, src, mx) => {
    d.els.push(
      el('text', { x: 4, y, w: 40, h: 2.8, text: lab, size: 2.2, color: '#7fd8ff', weight: 700, font: 'mono' }),
      el('bar', { x: 4, y: y + 3.2, w: 92, h: 2.2, src, min: 0, max: mx, color: CY, grad: '#1e8bff,#38d5ff,#dffaff', bg: '#0b2140', radius: 40, segs: 28, stc: false, glow: CY, gs: 0.4 })
    );
  };
  bar(52, 'TEMPO', 'speed', 240);
  bar(58, 'LIMIT', 'limit', 240);
  d.els.push(el('bar', { x: 4, y: 63.4, w: 92, h: 2.2, src: 'speed', min: 0, max: 240, color: '#ff9f3a', bg: '#1a1020', radius: 40, segs: 0, stc: true, limitMark: true }));
  // Kacheln 2x3
  const tile = (x, y, lab, src, unit, dec) => {
    d.els.push(
      el('rect', { x, y, w: 44, h: 9.5, grad: '#0c2448,#041027', gang: 170, radius: 8, border: 0.4, bgrad: CY + ',' + GL, bmode: 'linear', bang: 160, shine: 0.06, drop: true }),
      el('text', { x: x + 2, y: y + 0.8, w: 40, h: 2.8, text: lab, size: 2, color: '#7fd8ff', weight: 700, font: 'mono' }),
      el('value', { x: x + 2, y: y + 4, w: 40, h: 5.2, src, unit, dec: dec || 0, size: 3.8, weight: 800, font: 'condensed', color: '#ffffff', tgrad: '#ffffff,#b8ecff', align: 'l' })
    );
  };
  tile(3, 67.5, 'GESAMT', 'total', ' km');
  tile(53, 67.5, 'TRIP', 'trip', ' km', 1);
  tile(3, 78, 'TAGES-KM', 'day', ' km', 1);
  tile(53, 78, 'HÖHE NN', 'altnn', ' m');
  tile(3, 88.5, 'SATELLITEN', 'sat', '');
  tile(53, 88.5, 'WIND', 'wind', ' km/h');
  out(d);
})();

// ===== Navi-Designs: Navi auf einem Viertel der Fläche, Werte verteilt, Blau-Grau, wichtige Zahlen grün/gelb/orange =====
(() => {
  const C = { bg: '#0d1520', grad: 'linear-gradient(155deg,#17263a 0%,#0e1724 55%,#0a1018 100%)', panel: '#162232', line: '#2b3d54', lab: '#8fa4be', txt: '#e8eef6', grn: '#3ddc97', yel: '#ffd23f', org: '#ff9f43', blu: '#6cb6ff' };
  const fit = (max, w, chars, asp) => +Math.min(max, w * asp / (0.6 * chars)).toFixed(2);
  const mk = (name, asp, orient) => { const d = D.blank(name); d.aspect = asp; d.orient = orient; d.bg.color = C.bg; d.bg.grad = C.grad; return d; };
  const panel = (x, y, w, h, extra) => el('rect', Object.assign({ x, y, w, h, color: C.panel, radius: 14, border: 0.35, borderColor: C.line }, extra || {}));
  // Kachel: Fläche, Beschriftung oben links, Wert darunter
  const tile = (asp, x, y, w, h, label, src, o) => {
    o = o || {}; const chars = o.chars || 6, ls = fit(h * 0.16, w * 0.86 * 0.82, Math.max(8, label.length), asp), vs = fit(h * 0.44, w * 0.88, chars, asp);
    return [panel(x, y, w, h),
      el('text', { x: x + w * 0.06, y: y + h * 0.07, w: w * 0.88, h: h * 0.26, text: label, size: ls, color: C.lab, weight: 700, align: 'l' }),
      el('value', Object.assign({ x: x + w * 0.06, y: y + h * 0.36, w: w * 0.88, h: h * 0.56, src, size: vs, color: o.color || C.txt, weight: 800, font: 'condensed', align: 'l' }, o.v || {}))];
  };
  const naviBox = (asp, x, y, w, h, lay, size) => el('navi', { x, y, w, h, size, lay, color: C.yel, style: 'klassisch', box: false });

  // --- Querformat 2,12: Navi links (Viertel), Tempo Mitte, sechs Kacheln rechts
  (() => {
    const a = 2.12, d = mk('Navi Quer', a, 'land');
    d.els.push(panel(1.5, 4, 24, 92, { color: '#13253d', borderColor: '#2f5d8f' }),
      el('text', { x: 3, y: 6, w: 20, h: 6, text: 'NAVI', size: 3.4, color: C.blu, weight: 800, align: 'l' }),
      naviBox(a, 2.5, 12, 22, 56, 'hoch', 12),
      el('text', { x: 3, y: 71, w: 10, h: 5, text: 'REST', size: 3, color: C.lab, weight: 700, align: 'l' }),
      el('value', { x: 3, y: 76, w: 11, h: 14, src: 'navremain', size: fit(9, 11, 6, a), color: C.yel, weight: 800, font: 'condensed', align: 'l' }),
      el('text', { x: 14, y: 71, w: 10, h: 5, text: 'ANKUNFT', size: 3, color: C.lab, weight: 700, align: 'l' }),
      el('value', { x: 14, y: 76, w: 10.5, h: 14, src: 'naveta', size: fit(9, 10.5, 5, a), color: C.org, weight: 800, font: 'condensed', align: 'l' }),
      el('value', { x: 27, y: 6, w: 34, h: 52, src: 'speed', size: fit(46, 34, 3, a), color: C.grn, weight: 900, font: 'condensed', align: 'c', stc: true }),
      el('text', { x: 27, y: 57, w: 34, h: 7, text: 'km/h', size: 4.2, color: C.lab, weight: 700, align: 'c' }),
      el('sign', { x: 28.5, y: 67, w: 26 / a, h: 26 }),
      el('road', { x: 42, y: 70, w: 19, h: 9, size: 4.4, color: C.txt, align: 'l' }),
      el('next', { x: 42, y: 81, w: 19, h: 10, size: 3.6 }));
    const cw = 17.4, rh = 26, xs = [62.5, 81], ys = [13, 41.5, 70];
    [['HÖHE', 'alt', { color: C.yel, v: { unit: ' m' } }], ['RICHTUNG', 'dirname', { color: C.blu, chars: 4 }], ['UHRZEIT', 'clock', { chars: 5 }], ['TAGES-KM', 'day', { v: { unit: ' km', dec: 1 } }], ['HÖCHSTTEMPO', 'max', { color: C.org, v: { unit: ' km/h' }, chars: 7 }], ['TEMPERATUR', 'temp', { v: { unit: '°' }, chars: 4 }]]
      .forEach(([l, s, o], i) => d.els.push(...tile(a, xs[i % 2], ys[Math.floor(i / 2)], cw, rh, l, s, o)));
    out(d);
  })();

  // --- Hochformat 0,47: Navi oben (Viertel), Tempo, sechs Kacheln
  (() => {
    const a = 0.47, d = mk('Navi Hochformat', a, 'port');
    d.els.push(panel(3, 6, 94, 21.5, { color: '#13253d', borderColor: '#2f5d8f' }),
      naviBox(a, 5, 7, 90, 11.5, 'quer', 5.8),
      el('rect', { x: 5, y: 19, w: 90, h: 0.2, color: C.line, radius: 0 }),
      el('text', { x: 6, y: 19.6, w: 40, h: 2.4, text: 'REST', size: 1.5, color: C.lab, weight: 700, align: 'l' }),
      el('value', { x: 6, y: 21.7, w: 42, h: 5, src: 'navremain', size: fit(4, 42, 7, a), color: C.yel, weight: 800, font: 'condensed', align: 'l' }),
      el('text', { x: 52, y: 19.6, w: 42, h: 2.4, text: 'ANKUNFT', size: 1.5, color: C.lab, weight: 700, align: 'r' }),
      el('value', { x: 52, y: 21.7, w: 42, h: 5, src: 'naveta', size: fit(4, 42, 5, a), color: C.org, weight: 800, font: 'condensed', align: 'r' }),
      el('value', { x: 3, y: 29, w: 62, h: 17, src: 'speed', size: fit(17, 62, 3, a), color: C.grn, weight: 900, font: 'condensed', align: 'c', stc: true }),
      el('text', { x: 3, y: 46, w: 62, h: 3, text: 'km/h', size: 2, color: C.lab, weight: 700, align: 'c' }),
      el('sign', { x: 70, y: 30, w: 24, h: 24 * a }),
      el('next', { x: 68, y: 42.5, w: 28, h: 5, size: 1.8 }),
      el('road', { x: 3, y: 49.6, w: 94, h: 3.8, size: 2.3, color: C.txt, align: 'c' }));
    const cw = 46, rh = 13.2, xs = [3, 51], ys = [54.5, 69.3, 84.1];
    [['HÖHE', 'alt', { color: C.yel, v: { unit: ' m' } }], ['RICHTUNG', 'dirname', { color: C.blu, chars: 4 }], ['UHRZEIT', 'clock', { chars: 5 }], ['TAGESKILOMETER', 'day', { v: { unit: ' km', dec: 1 } }], ['HÖCHSTTEMPO', 'max', { color: C.org, v: { unit: ' km/h' }, chars: 7 }], ['TEMPERATUR', 'temp', { v: { unit: '°' }, chars: 4 }]]
      .forEach(([l, s, o], i) => d.els.push(...tile(a, xs[i % 2], ys[Math.floor(i / 2)], cw, rh, l, s, o)));
    out(d);
  })();

  // --- Geteilter Bildschirm (fast quadratisch): Navi oben (Viertel), Tempo links, vier Kacheln rechts
  const split = (name, a, orient) => {
    const d = mk(name, a, orient);
    d.els.push(panel(2, 12, 96, 22, { color: '#13253d', borderColor: '#2f5d8f' }),
      naviBox(a, 3.5, 13.5, 64, 19, 'quer', fit(9, 40, 6, a)),
      el('text', { x: 70, y: 13.5, w: 26, h: 4, text: 'REST', size: 2.6, color: C.lab, weight: 700, align: 'r' }),
      el('value', { x: 68, y: 17, w: 28, h: 6.5, src: 'navremain', size: fit(5.5, 28, 7, a), color: C.yel, weight: 800, font: 'condensed', align: 'r' }),
      el('text', { x: 70, y: 23.5, w: 26, h: 4, text: 'ANKUNFT', size: 2.6, color: C.lab, weight: 700, align: 'r' }),
      el('value', { x: 68, y: 27, w: 28, h: 6.5, src: 'naveta', size: fit(5.5, 28, 5, a), color: C.org, weight: 800, font: 'condensed', align: 'r' }),
      el('value', { x: 2, y: 36, w: 47, h: 27, src: 'speed', size: fit(26, 47, 3, a), color: C.grn, weight: 900, font: 'condensed', align: 'c', stc: true }),
      el('text', { x: 2, y: 62.5, w: 47, h: 5, text: 'km/h', size: 3.4, color: C.lab, weight: 700, align: 'c' }),
      el('road', { x: 2, y: 68, w: 47, h: 6, size: fit(3.8, 47, 18, a), color: C.txt, align: 'c' }),
      el('sign', { x: 25.5 - 20 / a / 2, y: 76, w: 20 / a, h: 20 }));
    const ys = [36, 51.9, 67.8, 83.7], rh = 14.4;
    [['HÖHE', 'alt', { color: C.yel, v: { unit: ' m' } }], ['RICHTUNG', 'dirname', { color: C.blu, chars: 4 }], ['UHRZEIT', 'clock', { chars: 5 }], ['TAGES-KM', 'day', { v: { unit: ' km', dec: 1 } }]]
      .forEach(([l, s, o], i) => d.els.push(...tile(a, 51, ys[i], 47, rh, l, s, o)));
    out(d);
  };
  split('Navi Split Hoch', 0.95, 'port');
  split('Navi Split Quer', 1.06, 'land');
})();
