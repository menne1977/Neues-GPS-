/* Navi: Ziel suchen, Route berechnen, Abbiegehinweise. Ohne Schlüssel, nur freie Dienste:
   Suche: Nominatim (OpenStreetMap). Route: Valhalla (OSM Deutschland), ersatzweise OSRM. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const hav = (a, b, c, d) => {
    const dLat = (c - a) * RAD, dLon = (d - b) * RAD;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  const ARROW = { depart: '⬆', straight: '⬆', slight_right: '↗', right: '➡', sharp_right: '↘', uturn: '⮌', sharp_left: '↙', left: '⬅', slight_left: '↖', roundabout: '⟳', arrive: '⚑', ramp: '↗', merge: '⬆' };
  const VAL = { 1: 'depart', 2: 'depart', 3: 'depart', 4: 'arrive', 5: 'arrive', 6: 'arrive', 7: 'straight', 8: 'straight', 9: 'slight_right', 10: 'right', 11: 'sharp_right', 12: 'uturn', 13: 'uturn', 14: 'sharp_left', 15: 'left', 16: 'slight_left', 17: 'straight', 18: 'slight_right', 19: 'slight_left', 20: 'slight_right', 21: 'slight_left', 22: 'straight', 23: 'slight_right', 24: 'slight_left', 25: 'straight', 26: 'roundabout', 27: 'roundabout', 37: 'straight', 38: 'straight' };

  function decode6(str, prec) {
    const f = Math.pow(10, prec || 6); let i = 0, lat = 0, lon = 0; const out = [];
    while (i < str.length) {
      for (let k = 0; k < 2; k++) {
        let sh = 0, r = 0, b;
        do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
        const d = (r & 1) ? ~(r >> 1) : (r >> 1);
        if (k === 0) lat += d; else lon += d;
      }
      out.push({ lat: lat / f, lon: lon / f });
    }
    return out;
  }

  const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // Kreisverkehr: Ausfahrt-Schritt (Typ 27) in den Einfahrt-Schritt übernehmen
  function foldRound(steps) {
    for (let k = steps.length - 1; k >= 0; k--) {
      const st = steps[k]; if (st.raw !== 27) continue;
      let j = k - 1; while (j >= 0 && steps[j].kind !== 'roundabout') j--;
      if (j >= 0) { steps[j].exitI = st.i; if (!steps[j].street) steps[j].street = st.street; steps.splice(k, 1); } else st.kind = 'straight';
    }
  }
  const bearing = (a, b) => { const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD), x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD); return (Math.atan2(y, x) / RAD + 360) % 360; };
  function finish(shape, steps, len, dur) {
    const cum = [0];
    for (let i = 1; i < shape.length; i++) cum.push(cum[i - 1] + hav(shape[i - 1].lat, shape[i - 1].lon, shape[i].lat, shape[i].lon));
    steps.forEach((s) => { s.at = cum[Math.min(s.i, cum.length - 1)] || 0; });
    const idxAt = (d) => { let lo = 0, hi = cum.length - 1; d = Math.max(0, Math.min(cum[hi], d)); while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m + 1; else hi = m; } return lo; };
    steps.forEach((s) => {
      if (s.kind !== 'roundabout' || shape.length < 3) return;
      const i0 = Math.min(s.i, shape.length - 1), iE = Math.min(s.exitI != null ? s.exitI : idxAt(s.at + 60), shape.length - 1);
      const a = shape[idxAt(cum[i0] - 30)], b = shape[i0], c = shape[iE], d = shape[idxAt(cum[iE] + 30)];
      if (a === b || c === d) return;
      let ang = bearing(c, d) - bearing(a, b); ang = ((ang + 540) % 360) - 180; s.exitAng = Math.round(ang);
    });
    const geo = cum[cum.length - 1];
    return { shape, cum, len: geo, dur: dur && len ? dur * (geo / len) : (dur || 0), steps };
  }

  // ---- Suche: Photon (Komoot) und Nominatim gleichzeitig, der erste Treffer zählt ----
  const mapPhoton = (j) => ((j && j.features) || []).map((f) => {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    const street = p.street ? p.street + (p.housenumber ? ' ' + p.housenumber : '') : '';
    const head = p.name || street || p.city || '';
    const rest = [street && p.name ? street : '', p.postcode, p.city || p.town || p.village || p.county, p.state, p.country].filter((x) => x && x !== head);
    return { name: [head].concat(rest).join(', '), lat: +c[1], lon: +c[0], kind: p.osm_value };
  }).filter((x) => isFinite(x.lat) && isFinite(x.lon) && x.name);
  const mapNom = (j) => (j || []).map((x) => ({ name: clean(x.display_name).split(',').slice(0, 4).join(','), lat: +x.lat, lon: +x.lon, kind: x.type }));
  async function geocode(q, near, fetchFn) {
    const bias = near && near.lat != null ? `&lat=${near.lat}&lon=${near.lon}` : '';
    const nomView = near && near.lat != null ? `&viewbox=${near.lon - 1.5},${near.lat + 1.5},${near.lon + 1.5},${near.lat - 1.5}` : '';
    const jobs = [
      ['Photon', `https://photon.komoot.io/api/?limit=8&lang=de&q=${encodeURIComponent(q)}${bias}`, mapPhoton],
      ['Nominatim', `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=de&q=${encodeURIComponent(q)}${nomView}`, mapNom]
    ];
    const errs = [];
    const res = await new Promise((resolve) => {
      let left = jobs.length, done = false;
      jobs.forEach(([name, url, map]) => {
        const to = new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 9000));
        Promise.race([Promise.resolve(fetchFn(url, { headers: { 'Accept-Language': 'de' } })).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), to])
          .then((j) => { const l = map(j); if (l.length && !done) { done = true; resolve(l); } else if (!l.length) errs.push(name + ': leer'); })
          .catch((e) => { errs.push(name + ': ' + ((e && e.message) || e)); })
          .finally(() => { left--; if (!left && !done) resolve(null); });
      });
    });
    if (!res) { const hard = errs.filter((e) => !/leer/.test(e)); if (hard.length >= jobs.length) throw new Error('Suche nicht erreichbar (' + hard[0] + ')'); return []; }
    if (near && near.lat != null) res.sort((x, y) => hav(near.lat, near.lon, x.lat, x.lon) - hav(near.lat, near.lon, y.lat, y.lon));
    return res;
  }

  // ---- Route: Valhalla (mehrere Varianten mit Profil, Kurven, Streckenart) ----
  function parseTrip(t) {
    const shape = []; const steps = [];
    t.legs.forEach((leg) => {
      const off = shape.length ? shape.length - 1 : 0;
      const pts = decode6(leg.shape, 6);
      (shape.length ? pts.slice(1) : pts).forEach((p) => shape.push(p));
      (leg.maneuvers || []).forEach((m) => steps.push({
        i: off + (m.begin_shape_index || 0), kind: VAL[m.type] || 'straight',
        text: clean(m.instruction), say: clean(m.verbal_pre_transition_instruction || m.instruction),
        street: clean((m.street_names || [])[0]), len: (m.length || 0) * 1000, t: m.time || 0, raw: m.type, exit: m.roundabout_exit_count || 0
      }));
    });
    foldRound(steps);
    const rt = finish(shape, steps, t.summary.length * 1000, t.summary.time);
    rt.flags = { toll: !!t.summary.has_toll, ferry: !!t.summary.has_ferry, highway: !!t.summary.has_highway };
    return rt;
  }
  // co: Profilwahl und Optionen, alt: Anzahl Alternativen. Liefert alle Routen (Haupt- und Alternativrouten).
  async function valhalla(a, b, fetchFn, co) {
    co = co || {};
    const costing = co.costing || 'auto';
    const req = { locations: [{ lat: a.lat, lon: a.lon, type: 'break' }, { lat: b.lat, lon: b.lon, type: 'break' }], costing, directions_options: { language: 'de-DE', units: 'kilometers' } };
    if (co.opt) { req.costing_options = {}; req.costing_options[costing] = co.opt; }
    if (co.alt) req.alternates = co.alt;
    if (co.polys && co.polys.length) req.exclude_polygons = co.polys;
    if (a.heading != null) req.locations[0].heading = Math.round(a.heading);
    const r = await fetchFn('https://valhalla1.openstreetmap.de/route?json=' + encodeURIComponent(JSON.stringify(req)), {});
    if (!r.ok) throw new Error('Valhalla HTTP ' + r.status);
    const j = await r.json();
    const trips = [j.trip].concat((j.alternates || []).map((x) => x.trip)).filter((t) => t && t.legs && t.legs.length);
    if (!trips.length) throw new Error('Keine Route');
    return trips.map(parseTrip);
  }
  async function viaValhalla(a, b, fetchFn) { return (await valhalla(a, b, fetchFn, {}))[0]; }

  // ---- Route: OSRM (Ersatz, Text selbst gebaut) ----
  const OS_MOD = { 'sharp right': 'sharp_right', right: 'right', 'slight right': 'slight_right', straight: 'straight', 'slight left': 'slight_left', left: 'left', 'sharp left': 'sharp_left', uturn: 'uturn' };
  const MOD_TXT = { sharp_right: 'scharf rechts abbiegen', right: 'rechts abbiegen', slight_right: 'leicht rechts halten', straight: 'geradeaus weiterfahren', slight_left: 'leicht links halten', left: 'links abbiegen', sharp_left: 'scharf links abbiegen', uturn: 'wenden' };
  async function viaOsrm(a, b, fetchFn) {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true`;
    const r = await fetchFn(url, {});
    if (!r.ok) throw new Error('OSRM HTTP ' + r.status);
    const j = await r.json();
    const rt = j.routes && j.routes[0]; if (!rt) throw new Error('Keine Route');
    const shape = rt.geometry.coordinates.map((c) => ({ lat: c[1], lon: c[0] }));
    const cum = [0]; for (let k = 1; k < shape.length; k++) cum.push(cum[k - 1] + hav(shape[k - 1].lat, shape[k - 1].lon, shape[k].lat, shape[k].lon));
    const nearestIdx = (loc) => { let bi = 0, bd = 1e12; for (let k = 0; k < shape.length; k++) { const d = hav(loc[1], loc[0], shape[k].lat, shape[k].lon); if (d < bd) { bd = d; bi = k; } } return bi; };
    const steps = [];
    (rt.legs || []).forEach((leg) => (leg.steps || []).forEach((s) => {
      const m = s.maneuver || {}; const mod = OS_MOD[m.modifier] || 'straight'; const street = clean(s.name);
      let kind = mod, txt;
      if (m.type === 'depart') { kind = 'depart'; txt = 'Losfahren' + (street ? ' auf ' + street : ''); }
      else if (m.type === 'arrive') { kind = 'arrive'; txt = 'Sie haben Ihr Ziel erreicht'; }
      else if (m.type === 'roundabout' || m.type === 'rotary') { kind = 'roundabout'; txt = 'Im Kreisverkehr ' + (m.exit ? 'die ' + m.exit + '. Ausfahrt nehmen' : 'ausfahren'); }
      else { txt = (MOD_TXT[mod] || 'weiterfahren') + (street ? ' auf ' + street : ''); txt = txt.charAt(0).toUpperCase() + txt.slice(1); }
      steps.push({ i: nearestIdx(m.location || [shape[0].lon, shape[0].lat]), kind, text: txt, say: txt, street, len: s.distance || 0, t: s.duration || 0, exit: m.exit || 0, raw: m.type === 'exit roundabout' || m.type === 'exit rotary' ? 27 : (kind === 'roundabout' ? 26 : 0) });
    }));
    steps.forEach((st, k) => { if (st.kind === 'roundabout' && steps[k + 1] && steps[k + 1].raw !== 27) st.exitI = steps[k + 1].i; });
    foldRound(steps);
    return finish(shape, steps, rt.distance, rt.duration);
  }

  async function route(a, b, fetchFn) {
    try { return await viaValhalla(a, b, fetchFn); }
    catch (e1) {
      try { return await viaOsrm(a, b, fetchFn); }
      catch (e2) { throw new Error('Route nicht berechenbar (' + String((e1 && e1.message) || e1).slice(0, 40) + ')'); }
    }
  }

  // ---- Kurvigkeit: Richtungswechsel pro Kilometer (Punkte alle ca. 60 m) ----
  function curviness(rt) {
    const pts = []; let acc = 0;
    for (let i = 0; i < rt.shape.length; i++) { if (!pts.length || rt.cum[i] - acc >= 60) { pts.push(rt.shape[i]); acc = rt.cum[i]; } }
    let sum = 0, bends = 0, run = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const h1 = Math.atan2((pts[i].lon - pts[i - 1].lon) * Math.cos(pts[i].lat * RAD), pts[i].lat - pts[i - 1].lat) / RAD;
      const h2 = Math.atan2((pts[i + 1].lon - pts[i].lon) * Math.cos(pts[i].lat * RAD), pts[i + 1].lat - pts[i].lat) / RAD;
      let d = Math.abs(((h2 - h1 + 540) % 360) - 180);
      if (d > 100) d = 0; // Abbiegen an Kreuzungen zählt nicht als Kurve
      if (d >= 4) { sum += d; run += d; } else { if (run >= 25) bends++; run = 0; }
    }
    const km = Math.max(0.5, rt.len / 1000);
    return { degPerKm: sum / km, bendsPerKm: bends / km };
  }

  const LAND = {
    wald: { label: 'Wald', test: (t) => t.natural === 'wood' || t.landuse === 'forest' },
    felder: { label: 'Felder und Wiesen', test: (t) => /^(farmland|meadow|orchard|vineyard|grass)$/.test(t.landuse || '') || t.natural === 'grassland' },
    wasser: { label: 'Wasser', test: (t) => /^(water|wetland)$/.test(t.natural || '') || /^(river|stream|canal)$/.test(t.waterway || '') },
    heide: { label: 'Heide', test: (t) => /^(heath|scrub)$/.test(t.natural || '') }
  };
  const OVS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  async function overpass(q, fetchFn) {
    return new Promise((resolve, reject) => {
      let fails = 0, done = false;
      const go = (k) => {
        if (done || k >= OVS.length) return;
        const to = setTimeout(() => { fails++; if (fails >= OVS.length && !done) reject(new Error('Landschaftsdaten nicht erreichbar')); }, 14000);
        Promise.resolve(fetchFn(OVS[k], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }))
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then((j) => { clearTimeout(to); if (!done) { done = true; resolve(j); } })
          .catch(() => { clearTimeout(to); fails++; if (fails >= OVS.length && !done) reject(new Error('Landschaftsdaten nicht erreichbar')); else go(k + 1); });
        if (k + 1 < OVS.length) setTimeout(() => { if (!done) go(k + 1); }, 2500);
      };
      go(0);
    });
  }
  // Anteil der Strecke mit gewünschter Landschaft (Stichproben alle ~500 m, höchstens 70)
  async function scenic(rt, kinds, fetchFn) {
    const step = Math.max(500, rt.len / 70), samples = []; let next = 0;
    for (let i = 0; i < rt.shape.length; i++) if (rt.cum[i] >= next) { samples.push(rt.shape[i]); next += step; }
    if (samples.length < 2) return { frac: 0, per: {} };
    const pts = samples.map((p) => p.lat.toFixed(5) + ',' + p.lon.toFixed(5)).join(',');
    const q = `[out:json][timeout:25];(nwr(around:150,${pts})["natural"~"^(wood|scrub|heath|grassland|water|wetland)$"];nwr(around:150,${pts})["landuse"~"^(forest|meadow|farmland|orchard|vineyard|grass)$"];nwr(around:150,${pts})["waterway"~"^(river|stream|canal)$"];);out tags bb 2500;`;
    const j = await overpass(q, fetchFn), pad = 0.0012;
    const els = (j.elements || []).map((e) => ({ t: e.tags || {}, b: e.bounds || (e.lat != null ? { minlat: e.lat, maxlat: e.lat, minlon: e.lon, maxlon: e.lon } : null) })).filter((e) => e.b);
    const per = {}; let hit = 0;
    kinds.forEach((k) => { per[k] = 0; });
    samples.forEach((p) => {
      let any = false;
      kinds.forEach((k) => {
        const f = LAND[k]; if (!f) return;
        if (els.some((e) => f.test(e.t) && p.lat >= e.b.minlat - pad && p.lat <= e.b.maxlat + pad && p.lon >= e.b.minlon - pad && p.lon <= e.b.maxlon + pad)) { per[k]++; any = true; }
      });
      if (any) hit++;
    });
    Object.keys(per).forEach((k) => { per[k] = per[k] / samples.length; });
    return { frac: hit / samples.length, per };
  }

  // Innenstädte entlang der Route finden und als Sperrflächen (Vielecke) liefern
  async function cityPolys(rt, a, b, fetchFn) {
    const step = 3000, samples = []; let next = 0;
    for (let i = 0; i < rt.shape.length; i++) if (rt.cum[i] >= next) { samples.push(rt.shape[i]); next += step; }
    if (samples.length < 2) return { polys: [], names: [] };
    const pts = samples.slice(0, 70).map((p) => p.lat.toFixed(4) + ',' + p.lon.toFixed(4)).join(',');
    const j = await overpass(`[out:json][timeout:25];node(around:3500,${pts})["place"~"^(city|town)$"];out tags center 120;`, fetchFn);
    const found = [];
    (j.elements || []).forEach((e) => {
      if (e.lat == null) return; const t = e.tags || {}, pop = +(t.population || 0);
      const r = pop >= 200000 ? 3000 : pop >= 100000 ? 2500 : pop >= 50000 ? 2000 : pop >= 20000 ? 1500 : (t.place === 'city' ? 2200 : 1100);
      let dmin = 1e12; for (let i = 0; i < rt.shape.length; i += 2) { const d = hav(e.lat, e.lon, rt.shape[i].lat, rt.shape[i].lon); if (d < dmin) dmin = d; }
      if (dmin < r + 500 && hav(a.lat, a.lon, e.lat, e.lon) > r + 2500 && hav(b.lat, b.lon, e.lat, e.lon) > r + 2500) found.push({ name: t.name || 'Innenstadt', lat: e.lat, lon: e.lon, r, pop });
    });
    found.sort((x, y) => y.r - x.r);
    const top = found.slice(0, 6);
    const polys = top.map((c) => { const ring = []; for (let k = 0; k < 16; k++) { const an = k / 16 * 2 * Math.PI; ring.push([+(c.lon + Math.cos(an) * c.r / (111320 * Math.cos(c.lat * RAD))).toFixed(5), +(c.lat + Math.sin(an) * c.r / 111320).toFixed(5)]); } ring.push(ring[0]); return ring; });
    return { polys, names: top.map((c) => c.name) };
  }

  /* Routenplaner mit Wahl.
     o.veh: 'auto' | 'motorrad'; o.curves: 'egal' | 'wenig' | 'mittel' | 'viele';
     o.type: 'normal' | 'schnell' | 'kurz' | 'sparsam' | 'lang' | 'gemuetlich'; o.scenic: ['wald','felder','wasser','heide'] */
  function mergeAvoid(opt, ex) {
    const o2 = Object.assign({}, opt), A = ex && ex.avoid; if (!A) return o2;
    if (A.highway) { o2.use_highways = 0; if (ex.strict) o2.exclude_highways = true; }
    if (A.toll) { o2.use_tolls = 0; if (ex.strict) o2.exclude_tolls = true; }
    if (A.ferry) { o2.use_ferry = 0; if (ex.strict) o2.exclude_ferries = true; }
    return o2;
  }
  async function planCore(a, b, o, fetchFn, progress, ex) {
    ex = ex || {};
    if (o.veh === 'fuss') {
      if (progress) progress('Fußweg rechnen …');
      const rs = await valhalla(a, b, fetchFn, { costing: 'pedestrian', opt: {}, alt: 0 });
      return { rt: rs[0], info: { cands: 1, curv: curviness(rs[0]), walk: true } };
    }
    const moto = o.veh === 'motorrad', costing = moto ? 'motorcycle' : 'auto';
    const variants = [{ costing, opt: {} }];
    const wantCurvy = o.curves !== 'egal' || o.scenic.length || o.type === 'gemuetlich' || o.type === 'lang';
    if (o.type === 'kurz' || o.type === 'sparsam') variants.push({ costing, opt: { shortest: true } });
    if (o.type === 'sparsam') variants.push({ costing, opt: { use_highways: 0.2 } });
    if (wantCurvy || o.type === 'schnell' || o.type === 'normal') variants.push({ costing, opt: { use_highways: 0 } }, { costing, opt: { use_highways: 0.5 } });
    if (wantCurvy && moto) variants.push({ costing, opt: { use_highways: 0, use_trails: 0.6 } });
    if (wantCurvy && !moto) variants.push({ costing, opt: { use_highways: 0, use_distance: 0.7 } });
    const alt = wantCurvy ? 2 : (o.type === 'schnell' || o.type === 'normal' ? 1 : 0);
    if (progress) progress('Varianten rechnen …');
    const all = [];
    let err = null;
    await Promise.all(variants.map((v) => valhalla(a, b, fetchFn, { costing: v.costing, opt: mergeAvoid(v.opt, ex), alt, polys: ex.polys }).then((rs) => rs.forEach((r) => all.push(r))).catch((e) => { err = e; })));
    if (!all.length && (ex.strict || (ex.polys && ex.polys.length))) throw (err || new Error('Keine Route'));
    if (!all.length) { const base = await route(a, b, fetchFn); return { rt: base, info: { note: 'Nur Standardroute möglich', cands: 1 } }; }
    // doppelte Routen entfernen (gleiche Länge, gleiche Mitte)
    const cands = [];
    all.forEach((r) => { if (!cands.some((c) => Math.abs(c.len - r.len) < 40 && Math.abs(c.dur - r.dur) < 20)) cands.push(r); });
    cands.forEach((c) => { c.curv = curviness(c); });
    const minDur = Math.min(...cands.map((c) => c.dur || 1e9)), minLen = Math.min(...cands.map((c) => c.len));
    const maxExtra = { schnell: 0.15, normal: 0.25, kurz: 0.6, sparsam: 0.5, lang: 1.4, gemuetlich: 0.9 }[o.type] || 0.3;
    const curveExtra = { wenig: 0.2, mittel: 0.5, viele: 0.9, egal: 0 }[o.curves] || 0;
    const limit = 1 + Math.max(maxExtra, curveExtra);
    let pool = cands.filter((c) => (c.dur || minDur) <= minDur * limit + 60);
    if (!pool.length) pool = cands.slice(0, 1);
    const cs = pool.map((c) => c.curv.degPerKm), cmin = Math.min(...cs), cmax = Math.max(...cs), cr = Math.max(1e-6, cmax - cmin);
    // Landschaft nur für die aussichtsreichsten Kandidaten abfragen (schont die Server)
    const kinds = (o.scenic || []).filter((k) => LAND[k]);
    if (kinds.length && pool.length) {
      if (progress) progress('Landschaft prüfen …');
      const top = pool.slice().sort((x, y) => Math.abs((x.dur || 0) - minDur) - Math.abs((y.dur || 0) - minDur)).slice(0, 4);
      await Promise.all(top.map((c) => scenic(c, kinds, fetchFn).then((sc) => { c.scenic = sc; }).catch(() => { c.scenic = null; })));
    }
    const score = (c) => {
      const cn = (c.curv.degPerKm - cmin) / cr, ex = ((c.dur || minDur) / minDur) - 1;
      let v = 0;
      if (o.curves === 'viele') v += 3 * cn; else if (o.curves === 'wenig') v += 3 * (1 - cn); else if (o.curves === 'mittel') v += 3 * (1 - Math.abs(cn - 0.5) * 2);
      if (o.type === 'kurz') v += 4 * (1 - (c.len - minLen) / Math.max(1, minLen)) ; // kürzer = besser
      else if (o.type === 'sparsam') v += 3 * (1 - (c.len - minLen) / Math.max(1, minLen)) - 1.5 * c.curv.degPerKm / Math.max(1, cmax);
      else if (o.type === 'lang') v += 3 * ((c.len - minLen) / Math.max(1, minLen));
      else if (o.type === 'gemuetlich') v += 1.0 * cn - 0.6 * ex;
      else if (o.type === 'schnell') v -= 4 * ex;
      else v -= 1.0 * ex;
      if (kinds.length) v += 4 * ((c.scenic && c.scenic.frac) || 0);
      if (o.type !== 'lang') v -= 0.6 * ex;
      return v;
    };
    pool.forEach((c) => { c.score = score(c); });
    pool.sort((x, y) => y.score - x.score);
    if (typeof process !== "undefined" && process.env.NAVDBG) console.log(pool.map((c) => [Math.round(c.len), Math.round(c.dur), Math.round(c.curv.degPerKm), c.score.toFixed(2)].join("/")).join("  "));
    const pk = o.pick ? o.pick % pool.length : 0, rt = pool[pk];
    const info = { pick: pk, pool: pool.length, cands: cands.length, curv: rt.curv, scenic: rt.scenic || null, minDur, extra: minDur ? (rt.dur / minDur - 1) : 0 };
    if (!kinds.length || !rt.scenic) info.noScenic = kinds.length > 0;
    const alts = [rt].concat(pool.filter((c) => c !== rt)).slice(0, 3);
    return { rt, info, alts };
  }

  async function plan(a, b, o, fetchFn, progress) {
    o = Object.assign({ veh: 'auto', curves: 'egal', type: 'normal', scenic: [], avoid: [] }, o || {});
    const av = o.avoid || [], xp = o.polys || [];
    if (o.veh === 'fuss' || !av.length) return planCore(a, b, o, fetchFn, progress, xp.length && o.veh !== 'fuss' ? { polys: xp } : {});
    const avoid = { highway: av.includes('autobahn'), toll: av.includes('maut'), ferry: av.includes('faehre'), city: av.includes('stadt') };
    let polys = [], names = [], notes = [];
    if (avoid.city) {
      if (progress) progress('Innenstädte suchen …');
      try {
        const first = await planCore(a, b, Object.assign({}, o, { curves: 'egal', scenic: [], type: 'schnell' }), fetchFn, null, { avoid, strict: true });
        const cp = await cityPolys(first.rt, a, b, fetchFn); polys = cp.polys; names = cp.names;
      } catch (e) { notes.push('Innenstädte konnte ich nicht prüfen'); }
    }
    polys = polys.concat(xp);
    let res, soft = false;
    try { res = await planCore(a, b, o, fetchFn, progress, { avoid, polys, strict: true }); }
    catch (e1) {
      try { res = await planCore(a, b, o, fetchFn, progress, { avoid, polys, strict: false }); soft = true; }
      catch (e2) {
        if (polys.length) { polys = []; names = []; notes.push('Innenstadt ließ sich nicht umfahren'); }
        res = await planCore(a, b, o, fetchFn, progress, { avoid, polys: [], strict: false }); soft = true;
      }
    }
    const f = res.rt.flags || {}, say = [];
    if (names.length && polys.length) say.push('Innenstadt umfahren: ' + names.slice(0, 3).join(', '));
    if (avoid.highway) say.push(f.highway ? 'Autobahn war nicht ganz vermeidbar' : 'ohne Autobahn');
    if (avoid.toll) say.push(f.toll ? 'Maut war nicht ganz vermeidbar' : 'ohne Maut');
    if (avoid.ferry) say.push(f.ferry ? 'eine Fähre ließ sich nicht vermeiden' : 'ohne Fähre');
    res.info = Object.assign(res.info || {}, { avoidSay: say.concat(notes), soft });
    return res;
  }

  const curveWord = (c) => (c.degPerKm < 25 ? 'gerade' : c.degPerKm < 60 ? 'leicht kurvig' : c.degPerKm < 110 ? 'kurvig' : 'sehr kurvig');
  function describe(res) {
    const i = res.info; if (!i) return '';
    let t = i.curv ? curveWord(i.curv) : '';
    if (i.scenic) { const parts = Object.keys(i.scenic.per).filter((k) => i.scenic.per[k] > 0.05).map((k) => Math.round(i.scenic.per[k] * 100) + ' % ' + LAND[k].label); if (parts.length) t += ', ' + parts.join(', '); }
    if (i.avoidSay && i.avoidSay.length) t += (t ? ', ' : '') + i.avoidSay.join(', ');
    return t;
  }

  // ---- Führung: Position auf der Route, nächster Schritt, Ansagen ----
  // Lage eines Punktes zur Route: Abstand und Meter entlang der Strecke
  function proj(rt, lat, lon, from) {
    const c = Math.cos(lat * RAD); let best = { d: 1e12, at: 0 };
    for (let k = Math.max(0, from || 0); k < rt.shape.length - 1; k++) {
      const A = rt.shape[k], B = rt.shape[k + 1];
      const ax = (A.lon - lon) * 111320 * c, ay = (A.lat - lat) * 111320, bx = (B.lon - lon) * 111320 * c, by = (B.lat - lat) * 111320;
      if (Math.min(Math.abs(ax), Math.abs(bx)) > 3000 && ax * bx > 0) continue; if (Math.min(Math.abs(ay), Math.abs(by)) > 3000 && ay * by > 0) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + dx * t, ay + dy * t); if (d < best.d) best = { d, at: rt.cum[k] + t * (rt.cum[k + 1] - rt.cum[k]) };
    }
    return best;
  }
  // Bahnübergänge entlang der Route (OSM railway=level_crossing). sicher: 'offen' | 'gesichert' | 'unbekannt'
  async function rails(rt, fetchFn) {
    const idx = []; let next = 0;
    for (let i = 0; i < rt.shape.length; i++) if (rt.cum[i] >= next || i === rt.shape.length - 1) { idx.push(i); next = rt.cum[i] + 120; }
    const out = [], seen = new Set();
    for (let i = 0; i < idx.length; i += 150) {
      const part = idx.slice(Math.max(0, i - 1), i + 150); if (part.length < 2) continue;
      const ll = part.map((k) => rt.shape[k].lat.toFixed(5) + ',' + rt.shape[k].lon.toFixed(5)).join(',');
      const j = await overpass(`[out:json][timeout:25];node(around:20,${ll})["railway"~"^(level_crossing|crossing)$"];out 300;`, fetchFn);
      for (const e of j.elements || []) {
        if (seen.has(e.id) || e.lat == null) continue; seen.add(e.id);
        const t = e.tags || {}, bar = t['crossing:barrier'], light = t['crossing:light'], cr = t.crossing;
        const secured = (bar && bar !== 'no') || light === 'yes' || /barrier|traffic_signals/.test(cr || '');
        const open = !secured && (bar === 'no' || light === 'no' || cr === 'uncontrolled' || t['crossing:saltire'] === 'yes' && bar === 'no');
        const p = proj(rt, e.lat, e.lon); if (p.d > 30) continue;
        out.push({ id: e.id, lat: e.lat, lon: e.lon, at: p.at, kind: open ? 'offen' : secured ? 'gesichert' : 'unbekannt', foot: t.railway === 'crossing' });
      }
    }
    return out.filter((r) => !r.foot).sort((a, b) => a.at - b.at);
  }

  // Feste Blitzer entlang der Route (OSM highway=speed_camera)
  async function cams(rt, fetchFn) {
    const idx = []; let next = 0;
    for (let i = 0; i < rt.shape.length; i++) if (rt.cum[i] >= next || i === rt.shape.length - 1) { idx.push(i); next = rt.cum[i] + 120; }
    const out = [], seen = new Set();
    for (let i = 0; i < idx.length; i += 150) {
      const part = idx.slice(Math.max(0, i - 1), i + 150); if (part.length < 2) continue;
      const ll = part.map((k) => rt.shape[k].lat.toFixed(5) + ',' + rt.shape[k].lon.toFixed(5)).join(',');
      const j = await overpass(`[out:json][timeout:25];node(around:35,${ll})["highway"="speed_camera"];out 300;`, fetchFn);
      for (const e of j.elements || []) {
        if (seen.has(e.id) || e.lat == null) continue; seen.add(e.id);
        const p = proj(rt, e.lat, e.lon); if (p.d > 40) continue;
        const ms = parseInt((e.tags || {}).maxspeed, 10);
        out.push({ id: e.id, lat: e.lat, lon: e.lon, at: p.at, max: ms > 0 ? ms : null });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  class Guide {
    constructor(rt) { this.rt = rt; this.idx = 0; this.off = 0; this.said = {}; this.arrived = false; this.state = null; }
    // Abstand von p zum Streckenstück k, plus Anteil t (0..1) und Meter entlang der Route
    seg(lat, lon, k) {
      const A = this.rt.shape[k], B = this.rt.shape[k + 1], c = Math.cos(lat * RAD);
      const ax = (A.lon - lon) * 111320 * c, ay = (A.lat - lat) * 111320, bx = (B.lon - lon) * 111320 * c, by = (B.lat - lat) * 111320;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, py = ay + dy * t;
      return { d: Math.sqrt(px * px + py * py), along: this.rt.cum[k] + t * (this.rt.cum[k + 1] - this.rt.cum[k]), lat: A.lat + (B.lat - A.lat) * t, lon: A.lon + (B.lon - A.lon) * t };
    }
    // cfg: { first: Meter der ersten Ansage oder 'auto', speed: m/s }
    update(lat, lon, acc, cfg) {
      cfg = cfg || {};
      const n = this.rt.shape.length - 1; if (n < 1) return null;
      let best = null;
      const scan = (a, b) => { for (let k = a; k < b; k++) { const s = this.seg(lat, lon, k); if (!best || s.d < best.d) best = { d: s.d, along: s.along, k, lat: s.lat, lon: s.lon }; } };
      scan(Math.max(0, this.idx - 3), Math.min(n, this.idx + 80));
      if (!best || best.d > 60) scan(0, n);
      const limit = Math.max(35, (acc || 10) * 2);
      if (best.d > limit) this.off++; else { this.off = 0; this.idx = best.k; }
      const along = best.along, remain = Math.max(0, this.rt.len - along);
      let ni = this.rt.steps.findIndex((s) => s.at > along - 12);
      if (ni < 0) ni = this.rt.steps.length - 1;
      while (ni < this.rt.steps.length - 1 && this.rt.steps[ni].kind === 'depart') ni++;
      const step = this.rt.steps[ni], dNext = Math.max(0, step.at - along);
      const rate = this.rt.dur && this.rt.len ? this.rt.dur / this.rt.len : 0.07;
      const end = this.rt.shape[n], dEnd = hav(lat, lon, end.lat, end.lon);
      this.arrived = remain < 25 && (best.d <= limit || dEnd < Math.max(40, (acc || 10) * 1.5));
      const say = [];
      if (!this.arrived && this.off === 0) {
        const key = (z) => ni + ':' + z;
        const sp = Math.max(0, cfg.speed || 0);
        const first = cfg.first === 'auto' || !cfg.first ? Math.max(300, Math.min(1500, Math.round(sp * 22 / 50) * 50)) : +cfg.first;
        const nxt = this.rt.steps[ni + 1], soon = nxt && nxt.kind !== 'depart' && (nxt.at - step.at) < 150;
        const dann = soon ? ', danach ' + lowerFirst(nxt.say) : '';
        const nice = (d) => (d >= 1000 ? Math.round(d / 100) * 100 : Math.round(d / 50) * 50);
        if (step.kind !== 'arrive' && step.kind !== 'depart') {
          if (dNext <= first + 25 && dNext > Math.max(170, first * 0.5) && !this.said[key('f')]) { this.said[key('f')] = 1; say.push('In ' + Guide.dist(nice(dNext)) + ' ' + lowerFirst(step.say)); }
          if (first >= 450 && dNext < 230 && dNext > Math.max(70, sp * 4) && !this.said[key('m')]) { this.said[key('m')] = 1; this.said[key('f')] = 1; say.push('In ' + Guide.dist(200) + ' ' + lowerFirst(step.say) + dann); }
          if (first < 450 && dNext <= first + 25 && dNext <= 170 && dNext > Math.max(60, sp * 4) && !this.said[key('f')]) { this.said[key('f')] = 1; say.push('In ' + Guide.dist(nice(dNext)) + ' ' + lowerFirst(step.say) + dann); }
        }
        if (step.kind !== 'depart' && dNext < (step.kind === 'arrive' ? Math.max(30, sp * 2) : Math.max(50, sp * 3.5)) && !this.said[key(0)]) { this.said[key(0)] = 1; say.push(step.say + (step.kind !== 'arrive' ? dann : '')); }
      }
      this.state = {
        off: this.off >= 3, along, remain, remainT: remain * rate, step, dNext, kind: step.kind, arrow: ARROW[step.kind] || '⬆', exit: step.exit || 0, exitAng: step.exitAng,
        then: (this.rt.steps[ni + 1] && step.kind !== 'arrive') ? { arrow: ARROW[this.rt.steps[ni + 1].kind] || '⬆', d: Math.max(0, this.rt.steps[ni + 1].at - along), kind: this.rt.steps[ni + 1].kind, exit: this.rt.steps[ni + 1].exit || 0, exitAng: this.rt.steps[ni + 1].exitAng } : null,
        street: step.street, text: step.text, arrived: this.arrived, say, pos: { lat, lon }, dev: best.d, snap: best.d <= limit ? { lat: best.lat, lon: best.lon } : null
      };
      return this.state;
    }
    static dist(m) { if (m >= 950 && m < 1050) return 'einem Kilometer'; return m >= 950 ? (Math.round(m / 100) / 10).toString().replace('.', ',') + ' Kilometern' : (Math.round(m / 10) * 10) + ' Metern'; }
  }

  // ---- Abbiege-Grafik (SVG). style: klassisch | schlank | kontur | zeichen ----
  const ANG = { straight: 0, depart: 0, merge: 0, slight_right: 40, right: 90, sharp_right: 135, slight_left: -40, left: -90, sharp_left: -135, ramp: 35 };
  function icon(st, o) {
    o = o || {}; const k = (st && st.kind) || 'straight', col = o.col || '#ffffff', bg = o.bg || '#0b1626', sty = o.style || 'klassisch';
    if (sty === 'zeichen') return `<span class="nvemo" style="color:${col}">${ARROW[k] || '⬆'}${k === 'roundabout' && st.exit ? '<sup>' + st.exit + '</sup>' : ''}</span>`;
    const w = sty === 'schlank' ? 8 : 14, f = (n) => n.toFixed(1);
    const lay = (el) => sty === 'kontur' ? el(col, w + 7) + el(bg, Math.max(3, w - 5)) : sty === 'klassisch' ? el('rgba(0,0,0,.55)', w + 6) + el(col, w) : el(col, w);
    const line = (d) => lay((c, sw) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
    const head = (x, y, dx, dy, s) => { const nx = -dy, ny = dx, pts = [[x + dx * s * 0.95, y + dy * s * 0.95], [x + nx * s * 0.75, y + ny * s * 0.75], [x - nx * s * 0.75, y - ny * s * 0.75]].map((p) => f(p[0]) + ',' + f(p[1])).join(' ');
      return sty === 'kontur' ? `<polygon points="${pts}" fill="${bg}" stroke="${col}" stroke-width="6" stroke-linejoin="round"/>` : (sty === 'klassisch' ? `<polygon points="${pts}" fill="rgba(0,0,0,.55)" stroke="rgba(0,0,0,.55)" stroke-width="6" stroke-linejoin="round"/>` : '') + `<polygon points="${pts}" fill="${col}" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`; };
    const hs = sty === 'schlank' ? 15 : 19;
    let g = '';
    if (k === 'arrive') {
      g = line('M36 90 L36 14') + lay((c, sw) => `<path d="M38 16 L78 28 L38 42 Z" fill="${c}" stroke="${c}" stroke-width="${Math.min(sw, 6)}" stroke-linejoin="round"/>`) + `<circle cx="36" cy="90" r="6" fill="${col}"/>`;
    } else if (k === 'uturn') {
      g = line('M64 92 L64 42 A19 19 0 0 0 26 42 L26 58') + head(26, 58, 0, 1, hs);
    } else if (k === 'roundabout') {
      const a = (st.exitAng != null ? st.exitAng : 90) * RAD, dx = Math.sin(a), dy = -Math.cos(a), cx = 50, cy = 52, r = 15;
      let trav = 180 - (st.exitAng != null ? st.exitAng : 90); trav = Math.max(25, Math.min(345, trav));
      const ex = cx + dx * r, ey = cy + dy * r, tx = ex + dx * 13, ty = ey + dy * 13;
      g = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-opacity=".35" stroke-width="${w}"/>`
        + line(`M50 96 L50 ${cy + r} A${r} ${r} 0 ${trav > 180 ? 1 : 0} 0 ${f(ex)} ${f(ey)} L${f(tx)} ${f(ty)}`) + head(tx, ty, dx, dy, hs * 0.85)
        + (st.exit ? `<text x="${cx}" y="${cy + 6}" font-size="17" font-weight="800" text-anchor="middle" fill="${col}" font-family="sans-serif">${st.exit}</text>` : '');
    } else {
      const a = (ANG[k] || 0) * RAD, dx = Math.sin(a), dy = -Math.cos(a), by = ANG[k] ? 54 : 30;
      const ex = 50 + dx * (ANG[k] ? 26 : 0), ey = by + dy * (ANG[k] ? 26 : 0);
      g = line(`M50 94 L50 ${by} L${f(ex)} ${f(ey)}`) + head(ex, ey, dx, dy, hs);
    }
    return `<svg class="nvico" viewBox="0 0 100 100" aria-hidden="true">${g}</svg>`;
  }

  const fmtDist = (m) => (m == null ? '–' : m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m');
  const fmtTime = (s) => { const m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };

  const api = { proj, rails, cams, icon, finish, overpass, geocode, route, plan, describe, curviness, scenic, LAND, Guide, decode6, hav, ARROW, fmtDist, fmtTime, distSay: Guide.dist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Nav = api;
})(typeof window !== 'undefined' ? window : globalThis);
