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

// 2) Sport-Balken quer: riesiges Tempo, Segment-Balken, Drehzahl-Balken
(() => {
  const d = D.blank('Sport Balken'); d.aspect = 2.1667; d.bg.color = '#0a0508';
  d.els.push(
    el('bar', { x: 3, y: 5, w: 94, h: 9, src: 'rpm', min: 0, max: 8000, color: '#ff5a1f', bg: '#1c0f12', radius: 4, segs: 40, stc: false, limitMark: false }),
    el('value', { x: 3, y: 15, w: 20, h: 8, src: 'rpm', unit: 'U/min', size: 5, color: '#ff9a6b', align: 'l', weight: 600 }),
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

// 4) Renn-Cockpit quer: Drehzahlmesser links mit Schaltleiste, riesiges Tempo, Werte-Kacheln, Tempo-Schild
(() => {
  const d = D.blank('Renn Cockpit'); d.aspect = 2.1667; d.bg.color = '#02030a';
  const gh = 82, gw = gh / 2.1667, gx = 2, gy = 14;
  d.els.push(
    el('bar', { x: 22, y: 3, w: 56, h: 5.5, src: 'rpm', min: 0, max: 15000, color: '#ff4a1c', bg: '#12182a', radius: 30, segs: 24, stc: false, limitMark: false }),
    el('rect', { x: gx - 0.5, y: gy - 1, w: gw + 1, h: gh + 2, color: '#050a18', radius: 50, border: 0.5, borderColor: '#1d3a8a' }),
    el('arc', { x: gx, y: gy, w: gw, h: gh, src: 'rpm', min: 0, max: 15000, a0: -130, a1: 110, thick: 4, color: '#2f8bff', bg: '#0f1a33', stc: false }),
    el('dial', { x: gx + 1.8, y: gy + 4, w: gw - 3.6, h: gh - 8, min: 0, max: 15, step: 1, minor: 4, a0: -130, a1: 110, color: '#dbe7ff', size: 3.4, lim: false }),
    el('needle', { x: gx, y: gy, w: gw, h: gh, src: 'rpm', min: 0, max: 15000, a0: -130, a1: 110, len: 56, width: 1.2, color: '#ffffff' }),
    el('value', { x: gx + 5, y: gy + 38, w: gw - 10, h: 15, src: 'rpm', size: 11, weight: 800, font: 'condensed', color: '#ffffff' }),
    el('text', { x: gx + 8, y: gy + 54, w: gw - 16, h: 5, text: 'U/MIN', size: 2.8, color: '#7f93bd', weight: 700 }),
    el('value', { x: gx + 8, y: gy + 62, w: gw - 16, h: 9, src: 'dirname', size: 6, color: '#7f93bd', weight: 700 }),
    el('value', { x: 44, y: 11, w: 36, h: 42, src: 'speed', size: 40, weight: 900, font: 'condensed', stc: true, align: 'c' }),
    el('text', { x: 62, y: 49, w: 18, h: 6, text: 'KM/H', size: 3.6, color: '#7f93bd', weight: 700, align: 'r' }),
    el('sign', { x: 82, y: 11, w: 16, h: 38 })
  );
  const box = (x, y, label, src, unit, dec, w) => {
    w = w || 16;
    d.els.push(
      el('rect', { x, y, w, h: 19, color: '#071022', radius: 8, border: 0.5, borderColor: '#1d3a8a' }),
      el('text', { x, y: y + 1.5, w, h: 5, text: label, size: 3, color: '#7f93bd', weight: 700 }),
      el('value', { x, y: y + 6.5, w, h: 11, src, unit, dec: dec || 0, size: 8, weight: 800, font: 'condensed' })
    );
  };
  box(44, 57, 'KÜHLMITTEL', 'cool', '°C'); box(63, 57, 'ÖL', 'oil', '°C'); box(82, 57, 'SPANNUNG', 'volt', 'V', 1);
  box(44, 78, 'TRIP', 'trip', 'km', 1, 22); box(68, 78, 'GESAMT', 'total', 'km', 0, 22);
  d.els.push(el('value', { x: 2, y: 1.5, w: 17, h: 9, src: 'clock', size: 6, weight: 800, font: 'condensed', align: 'l', color: '#9fb4e0' }));
  out(d);
})();

// 5) Fahr-Tacho Voll: Vorlage nach Kundenbild, volle Breite quer (Kopfzeile, drei Spalten)
(() => {
  const d = D.blank('Fahr-Tacho Voll'); d.aspect = 2.1667; d.bg.color = '#070c14';
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
    d.els.push(el('rect', { x, y, w, h, color: o.fill || '#101826', radius: 8, border: o.bw || 0.6, borderColor: o.line || '#1d2b44' }));
    d.els.push(el('text', { x, y: y + 1, w, h: 4.8, text: lab, size: o.ls || 3.3, color: o.lc || '#aab6c9', weight: 600, align: 'c' }));
    d.els.push(el('value', { x: x + (o.icon ? 4 : 0), y: y + (o.vy || 5.8), w: w - (o.icon ? 4 : 0), h: o.vh || 7.2, src, unit, dec: o.dec || 0, size: o.vs || 5.4, weight: 800, font: 'condensed', color: o.vc || '#ffffff', align: 'c' }));
    if (o.icon) d.els.push(el('image', { x: x + 1.2, y: y + (o.vy || 5.8) + 0.3, w: 3.2, h: 6.5, img: ICON[o.icon], fit: 'contain' }));
  };
  // Kopfzeile
  d.els.push(
    el('rect', { x: 1.2, y: 2, w: 97.6, h: 15, color: '#0f1827', radius: 14, border: 0.8, borderColor: '#2a3a58' }),
    el('road', { x: 2.6, y: 3.5, w: 27, h: 12, size: 6.6, color: '#ffffff', weight: 800, font: 'condensed', align: 'l' }),
    el('sign', { x: 31, y: 3.3, w: 6.6, h: 12.6 }),
    el('next', { x: 39, y: 3.3, w: 17, h: 12.6, size: 3.2 }),
    el('value', { x: 56, y: 3, w: 22, h: 13.5, src: 'clock', size: 9, weight: 800, font: 'condensed', color: '#38bdf8', align: 'r' })
  );
  // Mitte
  d.els.push(
    el('rect', { x: 25.8, y: 20, w: 48.4, h: 78, color: '#0d1420', radius: 10, border: 0.6, borderColor: '#1d2b44' }),
    el('value', { x: 27.5, y: 22, w: 14, h: 8, src: 'dirname', size: 6.2, weight: 800, color: '#38bdf8', align: 'l' }),
    el('value', { x: 27.5, y: 30, w: 14, h: 6, src: 'dir', unit: '°', size: 4, weight: 700, color: '#38bdf8', align: 'l' }),
    el('value', { x: 59, y: 24, w: 13.5, h: 8, src: 'temp', unit: '°C', size: 5.6, weight: 800, color: '#e8eefb', align: 'r' }),
    el('value', { x: 28, y: 33, w: 44, h: 38, src: 'speed', size: 31, weight: 900, font: 'condensed', color: '#ffffff', align: 'c' }),
    el('text', { x: 28, y: 69, w: 44, h: 6.5, text: 'km/h', size: 4.8, color: '#cbd5e1', weight: 600 }),
    el('bar', { x: 28.5, y: 77.5, w: 43, h: 4.2, src: 'speed', min: 0, max: 240, color: '#22c55e', grad: '#22c55e,#facc15,#ef4444', bg: '#1a2436', radius: 50, segs: 0, stc: false, limitMark: true }),
    el('text', { x: 28, y: 83, w: 44, h: 5, text: 'MAX Tempo', size: 3.6, color: '#ff9f5a', weight: 700 }),
    el('value', { x: 28, y: 88, w: 44, h: 9, src: 'max', unit: ' km/h', size: 6.2, weight: 800, font: 'condensed', color: '#ff7a3d', align: 'c' })
  );
  // Links
  const lx = 1.2, lw = 23;
  d.els.push(
    el('rect', { x: lx, y: 20, w: lw, h: 33, color: '#101826', radius: 8, border: 0.6, borderColor: '#1d2b44' }),
    el('text', { x: lx, y: 21, w: lw, h: 5, text: 'G-Kraft', size: 3.6, color: '#cbd5e1', weight: 600 }),
    el('arc', { x: lx + (lw - 8.4) / 2, y: 26.5, w: 8.4, h: 18.2, src: 'g', min: 0, max: 1.5, a0: -135, a1: 135, thick: 7, color: '#ef4444', bg: '#1b2638', stc: false }),
    el('value', { x: lx, y: 45.5, w: lw, h: 6.5, src: 'g', dec: 1, unit: ' G', size: 5.2, weight: 800, font: 'condensed', color: '#ffffff' })
  );
  tile(lx, 55, lw, 14, 'Höhe', 'alt', ' m', { icon: 'alt', vs: 5.6 });
  tile(lx, 71, lw, 13.5, 'Beschleunigung', 'acc', ' m/s²', { fill: '#10331f', line: '#22c55e', bw: 1, lc: '#86efac', vc: '#4ade80', dec: 1, ls: 3 });
  tile(lx, 86.5, lw, 11.5, 'Fahrzeit', 'time', ' h', { icon: 'clk', vs: 5, vy: 5, vh: 6, ls: 3 });
  // Rechts
  const rx = 75, rw = 23.8;
  const rh = 11.6, rv = { vy: 5, vh: 6, vs: 5, ls: 3 };
  tile(rx, 20, rw, rh, 'Bordspannung', 'volt', ' V', Object.assign({ icon: 'bat', dec: 1 }, rv));
  tile(rx, 33, rw, rh, 'Tageskilometer', 'day', ' km', Object.assign({ dec: 1, vc: '#38bdf8', lc: '#7aa7d9' }, rv));
  tile(rx, 46, rw, rh, 'Trip-Strecke', 'trip', ' km', Object.assign({ dec: 1 }, rv));
  tile(rx, 59, rw, rh, 'Gesamtkilometer', 'total', ' km', rv);
  tile(rx, 72, rw, rh, 'Satelliten', 'sat', ' SAT', Object.assign({ icon: 'sat', vc: '#38bdf8' }, rv));
  out(d);
})();
