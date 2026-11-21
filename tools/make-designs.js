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
