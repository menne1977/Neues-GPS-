/* Unterwegs: Tankstellen in der Nähe (OSM) und Autobahn-Meldungen (Autobahn GmbH).
   Tankstelle antippen = Navigation starten. Keine Tankpreise (kein Preis-Schlüssel). */
(function (root) {
  'use strict';
  const L = root.Limit;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const P = { fuel: [], jams: [], fuelT: 0, jamT: 0, fuelErr: '', jamErr: '', busy: {}, tab: 'fuel', api: null, open: false };

  // Gestaffelt wie in der alten App: erster Server sofort, bei Fehler oder nach 3 s zusätzlich der nächste, der erste Treffer gewinnt.
  // Verlässt sich nicht auf Abbrechen (in der APK kann eine Anfrage sonst ewig hängen), sondern hat eine feste Frist.
  const OV = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  let ovStart = 0;
  function ov(q, hedge) {
    const first = ovStart++ % OV.length;
    return new Promise((resolve, reject) => {
      let done = false, failed = 0, next = 0, last = ''; const timers = [];
      const fin = (fn, v) => { if (done) return; done = true; timers.forEach(clearTimeout); fn(v); };
      const go = () => {
        if (done || next >= OV.length) return;
        const u = OV[(first + next) % OV.length], h = new URL(u).host; next++;
        timers.push(setTimeout(go, hedge || 3500));
        fetch(u + '?data=' + encodeURIComponent(q)).then((r) => { if (!r.ok) throw new Error(h + ' HTTP ' + r.status); return r.json(); })
          .then((j) => fin(resolve, j))
          .catch((e) => { if (done) return; last = h + ' ' + ((e && e.message) || e); failed++; if (failed >= OV.length) fin(reject, new Error(last)); else go(); });
      };
      go();
      timers.push(setTimeout(() => fin(reject, new Error('Zeitüberschreitung')), 25000));
    });
  }
  const guard = (k) => { const t = Date.now(); if (P.busy[k] && t - P.busy[k] < 40000) return false; P.busy[k] = t; return true; };

  const brg = (la1, lo1, la2, lo2) => { const p = L.project(la2, lo2, la1, lo1); return L.bearing(0, 0, p[0], p[1]); };

  async function loadFuel(lat, lon, km) {
    if (!guard('fuel')) return; P.fuelErr = ''; P.fuelPos = { lat, lon };
    try {
      const j = await ov(`[out:json][timeout:25];nwr(around:${Math.round(km * 1000)},${lat},${lon})["amenity"="fuel"];out center 120;`);
      P.fuel = (j.elements || []).map((e) => {
        const la = e.lat != null ? e.lat : e.center && e.center.lat, lo = e.lon != null ? e.lon : e.center && e.center.lon;
        if (la == null) return null; const t = e.tags || {};
        return { name: t.brand || t.name || t.operator || 'Tankstelle', sub: [t.name && t.brand && t.name !== t.brand ? t.name : '', t['addr:street'] ? t['addr:street'] + (t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : '') : '', t['addr:city'] || ''].filter(Boolean).join(', '), la, lo, d: L.hav(lat, lon, la, lo) / 1000, b: brg(lat, lon, la, lo), open: t.opening_hours === '24/7' ? '24 h' : '' };
      }).filter(Boolean).sort((a, b) => a.d - b.d).slice(0, 60);
      P.fuelT = Date.now();
    } catch (e) { P.fuelErr = String((e && e.message) || e).slice(0, 80); }
    P.busy.fuel = 0; refresh();
  }

  async function loadJams(lat, lon, heading) {
    if (!guard('jam')) return; P.jamErr = ''; P.jamPos = { lat, lon };
    try {
      const j = await ov(`[out:json][timeout:25];way(around:30000,${lat},${lon})["highway"="motorway"]["ref"];out tags 80;`);
      const refs = [...new Set((j.elements || []).flatMap((e) => (e.tags.ref || '').split(';')).map((r) => r.replace(/\s+/g, '')).filter((r) => /^A\d+$/.test(r)))].slice(0, 6);
      let fails = 0;
      const res = await Promise.all(refs.map(async (r) => {
        try {
          const x = await fetch(`https://verkehr.autobahn.de/o/autobahn/${r}/services/warning`); if (!x.ok) throw new Error('HTTP ' + x.status);
          const w = await x.json();
          return (w.warning || []).map((y) => {
            const c = y.coordinate || {}; const la = parseFloat(c.lat), lo = parseFloat(c.long);
            const d = isFinite(la) ? L.hav(lat, lon, la, lo) / 1000 : null;
            const b = isFinite(la) ? brg(lat, lon, la, lo) : null;
            return { road: r, title: y.title || '', sub: y.subtitle || '', desc: (y.description || []).filter(Boolean).slice(0, 3).join(' · '), d, ahead: heading != null && b != null && d != null && d < 40 && L.angDiff(heading, b) < 55, blocked: y.isBlocked === 'true' || y.isBlocked === true, la, lo };
          });
        } catch (e) { fails++; return []; }
      }));
      if (refs.length && fails === refs.length) throw new Error('Autobahn-Dienst nicht erreichbar');
      P.jams = res.flat().sort((a, b) => (b.ahead - a.ahead) || ((a.d == null ? 999 : a.d) - (b.d == null ? 999 : b.d))).slice(0, 40);
      P.jamT = Date.now();
    } catch (e) { P.jamErr = String((e && e.message) || e).slice(0, 80); }
    P.busy.jam = 0; refresh();
  }

  // Aus der App aufgerufen (Position und Einstellungen)
  function ensure(pos, km, force) {
    if (!pos || pos.lat == null) return;
    P.pos = pos;
    const mv = (p) => p ? L.hav(p.lat, p.lon, pos.lat, pos.lon) / 1000 : 999;
    if (force || Date.now() - P.fuelT > 5 * 60000 || mv(P.fuelPos) > 2 || P.fuelErr) loadFuel(pos.lat, pos.lon, km);
    if (force || Date.now() - P.jamT > 3 * 60000 || mv(P.jamPos) > 6 || P.jamErr) loadJams(pos.lat, pos.lon, pos.heading);
    live();
  }

  // Abstand und Richtung laufend zur aktuellen Position neu rechnen, nicht erst beim nächsten Abruf
  function live() {
    const p = P.pos; if (!p) return;
    for (const f of P.fuel) { f.d = L.hav(p.lat, p.lon, f.la, f.lo) / 1000; f.b = brg(p.lat, p.lon, f.la, f.lo); }
    P.fuel.sort((a, b) => a.d - b.d);
    for (const j of P.jams) if (j.la != null) { j.d = L.hav(p.lat, p.lon, j.la, j.lo) / 1000; const b = brg(p.lat, p.lon, j.la, j.lo); j.ahead = p.heading != null && j.d < 40 && L.angDiff(p.heading, b) < 55; }
  }
  const ago = (t) => !t ? '' : (Date.now() - t < 90000 ? 'gerade eben' : 'vor ' + Math.round((Date.now() - t) / 60000) + ' min');
  let liveT = 0;
  function summary() {
    if (Date.now() - liveT > 2000) { liveT = Date.now(); live(); }
    const f = P.fuel[0]; const ahead = P.jams.filter((j) => j.ahead).length;
    return { fuel: f ? { d: f.d, name: f.name } : null, jams: P.jams.length, ahead, nearest: P.jams.find((j) => j.d != null) || null };
  }

  // ---------- Oberfläche ----------
  function root$() {
    let c = $('#places'); if (c) return c;
    c = document.createElement('div'); c.id = 'places';
    c.innerHTML = '<div class="pl-head"><div class="pl-tabs"><button data-tab="fuel">⛽ Tankstellen</button><button data-tab="jam">🚧 Stau Autobahn</button></div><button data-a="re">↻</button><button data-a="x">✕</button></div><div class="pl-body"></div><div class="pl-foot"></div>';
    document.body.appendChild(c);
    c.onclick = (e) => {
      const t = e.target.closest('[data-tab],[data-a],[data-go],[data-jam]'); if (!t) return;
      if (t.dataset.tab) { P.tab = t.dataset.tab; refresh(); }
      if (t.dataset.a === 'x') close();
      if (t.dataset.a === 're') { P.api.refresh(true); }
      if (t.dataset.go != null) { const f = P.fuel[+t.dataset.go]; if (f) P.api.navigate({ lat: f.la, lon: f.lo, name: f.name }); }
      if (t.dataset.jam != null) { const j = P.jams[+t.dataset.jam]; if (j && j.la != null) P.api.navigate({ lat: j.la, lon: j.lo, name: j.title }); }
    };
    return c;
  }
  function refresh() {
    if (!P.open) return; live();
    const c = root$(), body = $('.pl-body', c), foot = $('.pl-foot', c);
    c.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === P.tab));
    const dir = (b) => '<span class="pl-arr" style="transform:rotate(' + Math.round(b) + 'deg)">↑</span>';
    if (P.tab === 'fuel') {
      body.innerHTML = P.fuel.length ? P.fuel.map((f, i) => `<button class="pl-it" data-go="${i}"><span class="pl-n"><b>${esc(f.name)}</b><small>${esc(f.sub)}${f.open ? ' · ' + f.open : ''}</small></span><span class="pl-d">${dir(f.b)} ${f.d.toFixed(1).replace('.', ',')} km</span></button>`).join('')
        : `<div class="pl-e">${P.busy.fuel ? 'Suche Tankstellen …' : (P.fuelErr ? 'Nicht erreichbar: ' + esc(P.fuelErr) : 'Keine Tankstelle im Umkreis gefunden.')}</div>`;
      foot.textContent = 'Stand ' + ago(P.fuelT) + (P.fuelErr ? ' (Fehler: ' + P.fuelErr + ')' : '') + ' · Antippen startet die Navigation · keine Preise · Quelle: OpenStreetMap';
    } else {
      body.innerHTML = P.jams.length ? P.jams.map((j, i) => `<button class="pl-it${j.ahead ? ' ahead' : ''}" data-jam="${i}"><span class="pl-n"><b>${esc(j.road)} ${j.blocked ? '· gesperrt' : ''}${j.ahead ? ' · voraus' : ''}</b><small>${esc(j.title)}${j.sub ? ' – ' + esc(j.sub) : ''}${j.desc ? '<br>' + esc(j.desc) : ''}</small></span><span class="pl-d">${j.d != null ? j.d.toFixed(0) + ' km' : ''}</span></button>`).join('')
        : `<div class="pl-e">${P.busy.jam ? 'Lade Meldungen …' : (P.jamErr ? 'Nicht erreichbar: ' + esc(P.jamErr) : 'Keine Autobahn-Meldung im Umkreis von 30 km.')}</div>`;
      foot.textContent = 'Stand ' + ago(P.jamT) + (P.jamErr ? ' (Fehler: ' + P.jamErr + ')' : '') + ' · Autobahnen im Umkreis von 30 km · Quelle: Autobahn GmbH';
    }
  }
  function show(tab, api) { P.api = api || P.api; P.tab = tab || P.tab; P.open = true; root$().classList.add('on'); refresh(); P.api.refresh(false); }
  function close() { P.open = false; const c = $('#places'); if (c) c.classList.remove('on'); }

  root.Places = { P, ensure, summary, show, close, loadFuel, loadJams, refresh };
})(window);
