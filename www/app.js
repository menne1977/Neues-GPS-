/* Tacho: Hauptprogramm. Sensoren, Anzeige, Sprachsteuerung, Einstellungen. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const CAP = window.Capacitor && window.Capacitor.Plugins || {};
  const Voice = CAP.Voice, Gnss = CAP.Gnss, AppCtl = CAP.AppCtl, Phone = CAP.Phone, DFiles = CAP.DesignFiles;
  const L = window.Limit, Cmd = window.Cmd, Design = window.Design, Creator = window.Creator, Places = window.Places;

  // ---------- Kacheln ----------
  const TILES = [
    ['alt', 'Höhe'], ['dir', 'Richtung'], ['acc', 'Beschleunigung'], ['g', 'G-Kraft'], ['max', 'Höchsttempo'], ['avg', 'Ø Tempo Trip'],
    ['time', 'Fahrzeit Trip'], ['day', 'Tageskilometer'], ['trip', 'Trip'], ['total', 'Gesamt'], ['clock', 'Uhrzeit'], ['gps', 'GPS-Genauigkeit'],
    ['sat', 'Satelliten'], ['wx', 'Wetter'], ['wind', 'Böen'], ['grade', 'Steigung'], ['free', 'Spielraum'], ['tank', 'Nächste Tankstelle'], ['stau', 'Autobahn-Meldungen']
  ];
  const TNAME = Object.fromEntries(TILES);
  let grpOpen = null;
  // Kacheln mit mehreren Werten: Antippen schaltet der Reihe nach weiter
  const DEFGRP = { day: ['day', 'trip', 'total'], max: ['max', 'avg', 'time'], alt: ['alt', 'grade'], wx: ['wx', 'wind'], gps: ['gps', 'sat'], acc: ['acc', 'g'] };
  const grpOf = (id) => (S.tcyc && S.tcyc[id] && S.tcyc[id].length ? S.tcyc[id] : DEFGRP[id] || [id]);
  const shownId = (id) => { const g = grpOf(id); return g[((S.tix && S.tix[id]) || 0) % g.length]; };
  const DEFTILES = ['alt', 'dir', 'acc', 'max', 'day', 'trip', 'total', 'clock', 'tank', 'stau'];

  // ---------- Einstellungen ----------
  const DEF = {
    theme: 'nacht', accent: '#3ddc97', layout: 'auto', colsP: 2, colsL: 2, hero: 1, tsize: 1,
    unit: 'kmh', decimals: false, tol: 3, beep: true, warnSpeak: false, announce: false, preview: true,
    replies: true, vol: 80, wake: false, wakeWord: 'tacho', awake: true, online: true, wxOn: true, satOn: true, bt: false,
    ver: 2, navi: 'intern', navVoice: true, splitApp: { label: '', pkg: '' }, appCtl: false, fuelKm: 10, dLand: '', dPort: '', dSplit: '', scr: {},
    veh: 'auto', tcyc: {}, tix: {}, altRef: 'nn', napOff: 0, tiles: DEFTILES.slice(),
    day: { d: '', dist: 0, mt: 0, max: 0, altMin: null, altMax: null }, trip: { dist: 0, mt: 0, max: 0 }, total: 0, country: 'DE', countryT: 0, lp: null
  };
  let S = load();
  if (!S.ver) { // Update: Gesamtkilometer, Tankstellen und Stau erscheinen auch bei bestehender Einrichtung
    S.ver = 2;
    ['total', 'tank', 'stau'].forEach((id) => { if (!S.tiles.includes(id)) S.tiles.push(id); });
  }
  if (S.ver < 3) { // Zusammengehörige Werte teilen sich eine Kachel (Antippen wechselt)
    S.ver = 3; S.tcyc = S.tcyc || {}; S.tix = S.tix || {};
    for (const g of Object.values(DEFGRP)) { let first = true; S.tiles = S.tiles.filter((id) => { if (!g.includes(id)) return true; if (first) { first = false; return true; } return false; }); }
  }
  if (!S.tcyc) S.tcyc = {}; if (!S.tix) S.tix = {};
  let cur = null; // aktives eigenes Design
  function load() {
    try {
      const x = JSON.parse(localStorage.getItem('tacho2') || 'null');
      if (x) { const d = JSON.parse(JSON.stringify(DEF)); if (Array.isArray(x.tiles)) x.tiles = x.tiles.filter((id) => TNAME[id]); return Object.assign(d, x, { day: Object.assign(d.day, x.day), trip: Object.assign(d.trip, x.trip) }); }
    } catch (e) { /* neu starten */ }
    return JSON.parse(JSON.stringify(DEF));
  }
  let saveT = 0;
  function save(now) { const t = Date.now(); if (!now && t - saveT < 4000) return; saveT = t; try { localStorage.setItem('tacho2', JSON.stringify(S)); } catch (e) { /* voll */ } }

  // ---------- Laufzeitwerte ----------
  const R = {
    lat: null, lon: null, speed: 0, heading: null, headT: 0, compass: null, alt: null, altAcc: null, acc: null, accel: 0, g: null, gPeak: 0,
    fixT: 0, lastPos: null, sats: null, wx: null, wet: false, grade: null, altBuf: [],
    road: null, limit: null, next: null, lim: { shown: null, cand: null, n: 0, t: 0 }, state: 'none', lastWarn: 0, said: null,
    mic: { listening: false, recording: false, speaking: false }, netOk: true
  };
  const engine = new L.Engine();
  engine.country = S.country || 'DE';

  const KMH = 1, MPH = 0.621371;
  const fu = () => S.unit === 'mph' ? MPH : KMH;
  const uName = () => S.unit === 'mph' ? 'mph' : 'km/h';
  const dName = () => S.unit === 'mph' ? 'mi' : 'km';
  const fmt = (n, d) => (n == null || !isFinite(n)) ? '–' : n.toFixed(d == null ? 0 : d).replace('.', ',');

  // ---------- Hilfen ----------
  let toastT = 0;
  function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms || 3200); }
  function say(t) {
    toast(t, Math.min(8000, 2500 + t.length * 50));
    if (S.replies && Voice) Voice.speak({ text: t, pitch: 1, rate: 1.02, voice: '', volume: S.vol }).catch(() => {});
  }
  const dirName = (h) => h == null ? '–' : ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(h / 45) % 8];
  const dirLong = (h) => h == null ? 'unbekannt' : ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'][Math.round(h / 45) % 8];
  const hms = (ms) => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
  const WX = { 0: 'Sonne', 1: 'meist sonnig', 2: 'wolkig', 3: 'bedeckt', 45: 'Nebel', 48: 'Nebel', 51: 'Niesel', 53: 'Niesel', 55: 'Niesel', 56: 'Eisregen', 57: 'Eisregen', 61: 'Regen', 63: 'Regen', 65: 'Starkregen', 66: 'Eisregen', 67: 'Eisregen', 71: 'Schnee', 73: 'Schnee', 75: 'Starkschnee', 77: 'Schnee', 80: 'Schauer', 81: 'Schauer', 82: 'Starkschauer', 85: 'Schneeschauer', 86: 'Schneeschauer', 95: 'Gewitter', 96: 'Gewitter', 99: 'Gewitter' };

  // ---------- Layout, Thema ----------
  // Geteilter Bildschirm: das Fenster ist deutlich kleiner als der Bildschirm
  function isSplit() {
    const sw = Math.max(screen.width, screen.height), sh = Math.min(screen.width, screen.height);
    const w = innerWidth, h = innerHeight;
    return (w * h) < 0.62 * sw * sh && Math.max(w, h) < 0.8 * sw;
  }
  function scrKind() { return isSplit() ? (innerWidth > innerHeight ? 'splitL' : 'splitP') : (innerWidth > innerHeight ? 'land' : 'port'); }
  function measureScr() {
    if (!innerWidth || !innerHeight) return;
    const k = scrKind(), dpr = devicePixelRatio || 1;
    const v = { a: +(innerWidth / innerHeight).toFixed(4), w: Math.round(innerWidth * dpr), h: Math.round(innerHeight * dpr), t: Date.now() };
    const o = S.scr && S.scr[k];
    if (!o || Math.abs(o.a - v.a) > 0.005 || o.w !== v.w) { S.scr = Object.assign({}, S.scr, { [k]: v }); save(true); }
  }
  function isLand() { return S.layout === 'auto' ? innerWidth > innerHeight : S.layout === 'land'; }
  function applyLook() {
    const b = document.body, st = document.documentElement.style;
    b.classList.toggle('land', isLand()); b.classList.toggle('port', !isLand());
    b.dataset.theme = S.theme;
    st.setProperty('--acc', S.accent); st.setProperty('--hs', S.hero); st.setProperty('--ts', S.tsize);
    st.setProperty('--cols', isLand() ? S.colsL : S.colsP);
    if (typeof applyDesign === 'function') applyDesign();
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(b).getPropertyValue('--bg') || '#070b12';
  }
  async function applyOrient() {
    try {
      if (S.layout === 'auto') screen.orientation.unlock();
      else await screen.orientation.lock(S.layout === 'land' ? 'landscape' : 'portrait');
    } catch (e) { /* nicht überall erlaubt, das Layout folgt trotzdem */ }
  }
  addEventListener('resize', () => { if (cur && cur.m) cur.m.layout(); });
  addEventListener('resize', () => { applyLook(); render(); clearTimeout(R.msT); R.msT = setTimeout(measureScr, 700); });
  setTimeout(measureScr, 1500);

  let wl = null;
  async function applyAwake() {
    try {
      if (S.awake && 'wakeLock' in navigator && document.visibilityState === 'visible') { if (!wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } }
      else if (wl) { await wl.release(); wl = null; }
    } catch (e) { /* egal */ }
  }
  document.addEventListener('visibilitychange', () => { applyAwake(); if (document.visibilityState === 'hidden') save(true); });

  // ---------- Position ----------
  function onPos(p) {
    const c = p.coords, t = p.timestamp || Date.now();
    R.lat = c.latitude; R.lon = c.longitude; R.fixT = Date.now(); R.gpsT = Date.now(); R.approx = false;
    if (!S.lp || Date.now() - (S.lp.t || 0) > 30000) { S.lp = { lat: R.lat, lon: R.lon, t: Date.now() }; }
    let v = (c.speed != null && c.speed >= 0) ? c.speed * 3.6 : null;
    const lp = R.lastPos;
    if (lp) {
      const dt = (t - lp.t) / 1000, d = L.hav(lp.lat, lp.lon, R.lat, R.lon);
      if (c.accuracy < 50 && d > 3) { const km = d / 1000; S.total += km; S.trip.dist += km; S.day.dist += km; }
      if (v == null && dt > 0) v = d / dt * 3.6;
      if (dt > 0 && dt < 5 && v != null && lp.v != null) R.accel = (v - lp.v) / 3.6 / dt;
      if (v >= 3) { const mt = Math.min(t - lp.t, 60000); S.day.mt += mt; S.trip.mt += mt; }
    }
    if (v == null) v = 0;
    const today = new Date().toDateString();
    if (S.day.d !== today) S.day = { d: today, dist: 0, mt: 0, max: 0, altMin: null, altMax: null };
    if (c.accuracy < 50 && v < 330) { if (v > S.day.max) S.day.max = v; if (v > S.trip.max) S.trip.max = v; }
    R.speed = v; R.acc = c.accuracy;
    heroTarget = v * fu(); // Tempo sofort anzeigen, vor der schweren Auswertung
    if (Math.abs(heroTarget - heroShown) > 40 || heroShown === 0) heroShown = heroTarget;
    if (c.heading != null && !isNaN(c.heading) && v > 4) { R.heading = c.heading; R.headT = Date.now(); }
    if (c.msl != null || c.ell != null) { R.altMsl = c.msl; R.altEll = c.ell; R.altApprox = false; }
    else if (c.altitude != null && !isNaN(c.altitude)) { R.altMsl = c.altitude; R.altEll = null; R.altApprox = false; }
    const av = altVals(); R.alt = av.sel;
    if (R.alt != null) {
      R.altAcc = c.altitudeAccuracy;
      if (S.day.altMin == null || R.alt < S.day.altMin) S.day.altMin = R.alt;
      if (S.day.altMax == null || R.alt > S.day.altMax) S.day.altMax = R.alt;
      if (lp) {
        const last = R.altBuf[R.altBuf.length - 1], dd = L.hav(lp.lat, lp.lon, R.lat, R.lon);
        R.altBuf.push({ d: (last ? last.d : 0) + dd, a: R.alt });
        while (R.altBuf.length > 2 && R.altBuf[R.altBuf.length - 1].d - R.altBuf[1].d > 90) R.altBuf.shift();
        const f = R.altBuf[0], l = R.altBuf[R.altBuf.length - 1];
        R.grade = (l.d - f.d > 40 && v > 8) ? Math.max(-30, Math.min(30, (l.a - f.a) / (l.d - f.d) * 100)) : (v > 8 ? R.grade : null);
      }
    }
    R.lastPos = { lat: R.lat, lon: R.lon, t, v };
    S.lp = { lat: R.lat, lon: R.lon };
    updateLimit();
    heroTarget = v * fu();
    if (window.NavUI) NavUI.onFix();
    render(); save(); fetchStuff();
  }
  // Höhe in drei Bezügen: NN (Normalhöhennull, wie Landkarten), NAP (Amsterdamer Pegel) und Ellipsoid (rohe GPS-Höhe, WGS84)
  function altVals() {
    const nn = R.altMsl != null ? R.altMsl : null, ell = R.altEll != null ? R.altEll : null;
    const nap = nn != null ? nn - (S.napOff || 0) : null;
    return { nn, nap, ell, sel: S.altRef === 'nap' ? nap : S.altRef === 'ell' ? ell : nn };
  }
  const ALTN = { nn: 'NN', nap: 'NAP', ell: 'Ellipsoid' };
  // Ungefährer Ort (Netz oder letzter bekannter): nur für Tankstellen, Stau, Wetter. Keine Strecke, kein Tempo.
  function approxPos(f) {
    if (R.gpsT && Date.now() - R.gpsT < 6000) return;
    R.lat = f.lat; R.lon = f.lon; R.approx = true; R.acc = f.acc;
    S.lp = { lat: f.lat, lon: f.lon, t: Date.now() };
    if (S.online) placesApi.refresh(false);
  }
  function onErr(e) { R.fixT = 0; setChip('#cGps', 'bad', e && e.code === 1 ? 'GPS: Standort nicht erlaubt' : 'GPS: kein Signal'); }
  let webWatch = null, nativeFix = false;
  if (navigator.geolocation) webWatch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  if (Gnss && Gnss.startFix) {
    Gnss.addListener('fix', (f) => {
      if (!nativeFix) { nativeFix = true; if (webWatch != null) { navigator.geolocation.clearWatch(webWatch); webWatch = null; } }
      if (f.prov && f.prov !== 'gps') { approxPos(f); return; }
      onPos({ timestamp: f.t || Date.now(), coords: { latitude: f.lat, longitude: f.lon, accuracy: f.acc, speed: f.speed >= 0 ? f.speed : null, heading: f.bearing >= 0 ? f.bearing : null, altitude: f.alt, altitudeAccuracy: null, msl: f.msl, ell: f.ell } });
    });
    Gnss.startFix().catch(() => {});
  }
  if (Gnss && Gnss.startCompass) {
    Gnss.addListener('compass', (c) => { R.compass = c.h; R.compassT = performance.now(); });
    Gnss.startCompass().catch(() => {});
  }

  addEventListener('devicemotion', (e) => {
    const a = e.acceleration; if (!a || a.x == null) return;
    R.g = Math.hypot(a.x || 0, a.y || 0, a.z || 0) / 9.81;
    if (R.g > R.gPeak) R.gPeak = R.g;
  });
  let absSeen = false;
  function ori(e, abs) {
    if (abs) absSeen = true; else if (absSeen) return;
    let h = null;
    if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
    else if (e.alpha != null) h = (360 - e.alpha + ((screen.orientation && screen.orientation.angle) || 0)) % 360;
    if (h != null) R.compass = h;
  }
  addEventListener('deviceorientationabsolute', (e) => ori(e, true)); addEventListener('deviceorientation', (e) => ori(e, false));
  const headingRaw = () => (R.heading != null && Date.now() - R.headT < 8000 && R.speed > 4) ? R.heading : (R.compass != null ? R.compass : (R.heading != null && Date.now() - R.headT < 8000 ? R.heading : null));
  const headingNow = () => R.hd != null ? R.hd : headingRaw();

  // ---------- Tempolimit ----------
  function updateLimit() {
    if (R.lat == null) return;
    const now = new Date();
    const u = engine.update({ lat: R.lat, lon: R.lon, heading: (Date.now() - R.headT < 5000) ? R.heading : null, speed: R.speed, accuracy: R.acc, now, veh: S.veh, wet: R.wet });
    if (!u.road) {
      if (Date.now() - R.lim.t > 12000) { R.road = null; R.limit = null; R.next = null; R.lim.shown = null; }
      return;
    }
    R.lim.t = Date.now();
    const sig = JSON.stringify([u.limit.v, u.limit.kind]);
    if (R.lim.shown == null || R.lim.shown === sig) { R.lim.shown = sig; R.lim.n = 0; R.road = u.road; R.limit = u.limit; R.next = u.next; }
    else if (R.lim.cand === sig) { if (++R.lim.n >= 2) { R.lim.shown = sig; R.lim.n = 0; R.road = u.road; R.limit = u.limit; R.next = u.next; announceLimit(); } }
    else { R.lim.cand = sig; R.lim.n = 1; R.road = u.road; R.next = u.next; }
  }
  function announceLimit() {
    if (!S.announce || !R.limit || R.limit.v == null) return;
    const k = R.limit.kind + R.limit.v; if (R.said === k) return; R.said = k;
    if (Voice) Voice.speak({ text: 'Tempolimit ' + Math.round(R.limit.v * fu()), pitch: 1, rate: 1.05, voice: '', volume: S.vol }).catch(() => {});
  }
  function limitKmh() { return R.limit && R.limit.v != null && R.limit.kind !== 'advisory' ? R.limit.v : null; }
  function computeState() {
    const lim = limitKmh();
    if (lim == null) return 'none';
    const over = R.speed - lim;
    if (over <= 0.5) return 'ok';
    return over <= S.tol ? 'near' : 'over';
  }

  // ---------- Online-Daten ----------
  let wxPos = null, wxT = 0, netBusy = false, qBusy = false, qT = 0;
  async function fetchStuff() {
    if (!S.online || R.lat == null) return;
    const now = Date.now();
    if (engine.needFetch(R.lat, R.lon, false, R.speed)) {
      const ok = await engine.fetchRoads(R.lat, R.lon, (u, o) => fetch(u, o), (Date.now() - R.headT < 5000) ? R.heading : null);
      R.netOk = ok; if (ok) { updateLimit(); render(); } setNet();
    }
    // Zweite Karte als Schnellhilfe: Straßenname über Nominatim, solange die Straßendaten noch laden
    if (!R.road && !qBusy && now - qT > 4000 && (R.fixT && now - R.fixT < 6000)) {
      qBusy = true; qT = now;
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=${R.lat}&lon=${R.lon}`, { headers: { 'Accept-Language': 'de' } })
        .then((r) => r.json()).then((j) => { const a = j.address || {}; R.qname = a.road || a.pedestrian || a.residential || ''; R.qT = Date.now(); if (!R.road) render(); })
        .catch(() => {}).finally(() => { qBusy = false; });
    }
    if (now - S.countryT > 86400000 && !netBusy) {
      netBusy = true; S.countryT = now;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${R.lat}&lon=${R.lon}`, { headers: { 'Accept-Language': 'de' } });
        const j = await r.json(); const cc = ((j.address || {}).country_code || '').toUpperCase();
        if (cc) { S.country = cc; engine.country = cc; }
      } catch (e) { S.countryT = 0; setTimeout(() => { S.countryT = 0; }, 60000); }
      netBusy = false;
    }
    if (S.wxOn && now - wxT > 15 * 60000 && (!wxPos || L.hav(wxPos.lat, wxPos.lon, R.lat, R.lon) > 15000 || now - wxT > 30 * 60000)) {
      wxT = now; wxPos = { lat: R.lat, lon: R.lon };
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${R.lat}&longitude=${R.lon}&current=temperature_2m,weather_code,wind_gusts_10m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature&timezone=auto`);
        const j = await r.json();
        if (j.current) { R.wx = j.current; R.wet = (j.current.precipitation > 0.1) || ((j.current.weather_code >= 51 && j.current.weather_code <= 67) || (j.current.weather_code >= 80 && j.current.weather_code <= 82) || j.current.weather_code >= 95); }
      } catch (e) { wxT = now - 14 * 60000; }
    }
  }
  setInterval(() => { if (R.lat != null) fetchStuff(); }, 1500);
  setInterval(() => { if (S.online && (R.lat != null || S.lp) && (S.tiles.includes('tank') || S.tiles.includes('stau') || Places.P.open)) placesApi.refresh(false); }, 10000);
  setTimeout(() => { if (S.online && (R.lat != null || S.lp)) placesApi.refresh(false); }, 1500);

  // ---------- Anzeige ----------
  function setChip(id, cls, text) { const el = $(id); el.className = 'chip ' + cls; el.querySelector('span').textContent = text; }
  function setNet() {
    if (!S.online) setChip('#cNet', 'warn', 'Offline-Modus');
    else if (engine.error) setChip('#cNet', 'bad', 'Limit-Server: ' + engine.error);
    else setChip('#cNet', engine.center ? 'ok' : 'warn', engine.center ? 'Online' : 'Lade Straßen …');
  }

  function signHTML(lim, el) {
    const sign = el;
    sign.className = el.id === 'nsign' ? 'sign' : 'sign';
    const num = sign.querySelector('span');
    if (!lim) { sign.className += ' unk'; num.textContent = '–'; return; }
    if (lim.kind === 'none') { sign.className += ' none'; num.textContent = ''; return; }
    if (lim.v == null) { sign.className += ' unk'; num.textContent = '?'; return; }
    const shown = Math.round(lim.v * fu());
    num.textContent = shown;
    if (shown >= 100) sign.className += ' s3';
    if (lim.kind === 'advisory') sign.className += ' adv';
    else if (lim.kind === 'default') sign.className += ' est';
  }

  function trackMax() {
    const need = Math.max((limitKmh() || 50) * 1.45, R.speed * 1.08, 60);
    for (const m of [60, 80, 100, 120, 140, 160, 180, 200, 240, 280, 320]) if (need <= m) return m;
    return 360;
  }

  let heroShown = 0, heroTarget = 0, heroT = performance.now();
  function heroLoop(t) {
    const dt = Math.min(0.2, (t - heroT) / 1000); heroT = t;
    if (Date.now() - R.fixT > 6000 && R.fixT) heroTarget = 0;
    const diff = heroTarget - heroShown;
    if (Math.abs(diff) > 0.02) { heroShown += diff * Math.min(1, dt * 18); if (Math.abs(heroTarget - heroShown) < 0.05) heroShown = heroTarget; }
    const txt = S.decimals ? fmt(heroShown, 1) : String(Math.round(heroShown));
    const el = $('#speed'); if (el.textContent !== txt) el.textContent = txt;
    const hr = headingRaw();
    if (hr != null) { if (R.hd == null) R.hd = hr; else { let d = ((hr - R.hd + 540) % 360) - 180; if (Math.abs(d) > 0.2) R.hd = (R.hd + d * Math.min(1, dt * 12) + 360) % 360; } }
    if (t - (R.tileT || 0) > 120 && S.tiles.includes('dir')) { R.tileT = t; renderTiles(); }
    if (cur) cur.m.update(designApi());
    requestAnimationFrame(heroLoop);
  }
  requestAnimationFrame(heroLoop);

  function render() {
    // Status und Chips
    R.state = computeState();
    const b = document.body;
    b.classList.remove('st-ok', 'st-near', 'st-over', 'st-none'); b.classList.add('st-' + R.state);
    const fixAge = Date.now() - R.fixT;
    if (!R.fixT || fixAge > 6000) setChip('#cGps', R.lat == null ? 'warn' : 'bad', R.lat == null ? 'GPS sucht …' : 'GPS-Signal weg');
    else setChip('#cGps', R.acc > 30 ? 'warn' : 'ok', 'GPS ±' + Math.round(R.acc) + ' m');
    setNet();
    $('#unit').textContent = uName();

    // Schild und Straße
    signHTML(R.limit, $('#sign'));
    const cap = $('#signcap');
    if (!R.limit) cap.textContent = R.lat == null ? 'warte auf GPS' : (S.online ? 'keine Straße erkannt' : 'offline');
    else if (R.limit.kind === 'advisory') cap.textContent = 'Richtgeschwindigkeit';
    else if (R.limit.kind === 'none') cap.textContent = 'kein Limit';
    else if (R.limit.kind === 'default') cap.textContent = 'geschätzt';
    else cap.textContent = R.limit.note && /zeit/.test(R.limit.src) ? 'zeitabhängig' : 'Schild';
    $('#roadname').textContent = R.road ? (R.road.name || R.road.ref || '') : ((R.qname && Date.now() - (R.qT || 0) < 20000) ? R.qname : '');
    const meta = [];
    if (R.road) { meta.push(R.road.kind); if (R.road.ref && R.road.name) meta.push(R.road.ref); }
    if (R.limit && R.limit.note) meta.push(R.limit.note);
    $('#roadmeta').textContent = meta.join(' · ');

    // Fahrband
    const lim = limitKmh(), max = trackMax();
    $('#fill').style.width = Math.min(100, R.speed / max * 100) + '%';
    const nt = $('#notch'), ov = $('#over');
    if (lim != null) { nt.style.display = ''; nt.style.left = (lim / max * 100) + '%'; ov.style.display = ''; ov.style.left = (lim / max * 100) + '%'; ov.style.width = ''; }
    else { nt.style.display = 'none'; ov.style.display = 'none'; }
    const d = $('#dtxt');
    if (lim == null) d.innerHTML = R.limit && R.limit.kind === 'advisory' ? 'Richtwert ' + Math.round(R.limit.v * fu()) + ' ' + uName() : '&nbsp;';
    else { const diff = Math.round((lim - R.speed) * fu()); d.innerHTML = diff >= 0 ? `<b>${diff}</b> ${uName()} frei bis zum Limit` : `<b>${-diff}</b> ${uName()} zu schnell`; }
    $('#dmax').textContent = Math.round(max * fu());

    // Vorschau
    const nx = $('#next');
    if (S.preview && R.next && R.next.limit) { nx.hidden = false; signHTML(R.next.limit, $('#nsign')); $('#nd').textContent = 'in ' + Math.max(10, Math.round(R.next.dist / 10) * 10) + ' m'; }
    else nx.hidden = true;

    // Warnungen
    if (R.state === 'over' && Date.now() - R.lastWarn > 12000) {
      R.lastWarn = Date.now(); if (S.beep) beep();
      if (S.warnSpeak && Voice) Voice.speak({ text: 'Achtung, Tempolimit ' + Math.round(lim * fu()), pitch: 1, rate: 1.1, voice: '', volume: S.vol }).catch(() => {});
    }
    renderTiles();
  }

  // Warnton
  let actx = null;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      [0, 0.28].forEach((o) => {
        const osc = actx.createOscillator(), g = actx.createGain();
        osc.type = 'square'; osc.frequency.value = 880; g.gain.value = 0.18 * (S.vol / 80);
        osc.connect(g); g.connect(actx.destination); osc.start(actx.currentTime + o); osc.stop(actx.currentTime + o + 0.18);
      });
    } catch (e) { /* kein Ton */ }
  }
  addEventListener('pointerdown', () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* egal */ } }, { once: true });

  // ---------- Kachelwerte ----------
  const km = (x) => fmt(x * (S.unit === 'mph' ? MPH : 1), x < 100 ? 1 : 0);
  function tileData(id) {
    switch (id) {
      case 'alt': { const av = altVals(); const o = ['nn', 'nap', 'ell'].filter((k) => k !== S.altRef && av[k] != null).map((k) => ALTN[k] + ' ' + fmt(av[k])).join(' · '); return { v: fmt(av.sel), u: 'm ' + ALTN[S.altRef], s: o, dim: av.sel == null }; }
      case 'dir': { const h = headingNow(); return { v: dirName(h), u: h != null ? Math.round(h) + '°' : '', arrow: h, dim: h == null }; }
      case 'acc': { const a = R.accel; return { v: (a > 0 ? '+' : '') + fmt(a, 1), u: 'm/s²', s: a > 0.8 ? 'beschleunigt' : a < -0.8 ? 'bremst' : 'gleichmäßig' }; }
      case 'g': return { v: R.g != null ? fmt(R.g, 2) : '–', u: 'g', s: R.g != null ? 'Spitze ' + fmt(R.gPeak, 2) : 'kein Sensor', dim: R.g == null };
      case 'max': return { v: fmt(S.day.max * fu()), u: uName(), s: 'Trip ' + fmt(S.trip.max * fu()) };
      case 'avg': return { v: S.trip.mt > 30000 ? fmt(S.trip.dist / (S.trip.mt / 3600000) * fu()) : '–', u: uName(), s: 'in Bewegung' };
      case 'time': return { v: hms(S.trip.mt), u: 'h', s: 'in Bewegung' };
      case 'day': return { v: km(S.day.dist), u: dName(), s: 'heute' };
      case 'trip': return { v: km(S.trip.dist), u: dName(), s: 'Trip' };
      case 'total': return { v: fmt(S.total * (S.unit === 'mph' ? MPH : 1)), u: dName(), s: 'seit Start' };
      case 'clock': { const d = new Date(); return { v: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), u: '', s: d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) }; }
      case 'gps': return { v: R.acc != null ? '±' + Math.round(R.acc) : '–', u: 'm', s: R.acc == null ? '' : R.acc < 8 ? 'sehr gut' : R.acc < 20 ? 'gut' : 'schwach', dim: R.acc == null };
      case 'sat': return { v: R.sats ? R.sats.used + '/' + R.sats.visible : '–', u: '', s: R.sats ? 'genutzt/sichtbar' : (Gnss ? 'Satelliten werden gelesen' : 'nur in der APK'), dim: !R.sats };
      case 'wx': return R.wx ? { v: fmt(R.wx.temperature_2m, 0), u: '°C', s: WX[R.wx.weather_code] || '' } : { v: '–', u: '°C', s: S.online && S.wxOn ? 'lädt …' : 'aus', dim: true };
      case 'wind': return R.wx ? { v: fmt(R.wx.wind_gusts_10m * fu()), u: uName(), s: 'Böen' } : { v: '–', u: uName(), dim: true };
      case 'grade': return { v: R.grade != null ? (R.grade > 0 ? '+' : '') + fmt(R.grade, 1) : '–', u: '%', s: R.grade == null ? 'wird gemessen' : R.grade > 1.5 ? 'bergauf' : R.grade < -1.5 ? 'bergab' : 'eben', dim: R.grade == null };
      case 'free': { const lim = limitKmh(); return lim == null ? { v: '–', u: uName(), s: 'kein Limit', dim: true } : { v: ((lim - R.speed) >= 0 ? '+' : '−') + Math.abs(Math.round((lim - R.speed) * fu())), u: uName(), s: 'zum Limit' }; }
      case 'tank': { const t = Places.summary().fuel; return t ? { v: fmt(t.d * (S.unit === 'mph' ? MPH : 1), 1), u: dName(), s: t.name } : { v: '–', u: dName(), s: S.online ? 'tippen: suchen' : 'offline', dim: true }; }
      case 'stau': { const t = Places.summary(); return { v: String(t.jams), u: '', s: t.ahead ? t.ahead + ' voraus' : (t.nearest && t.nearest.d != null ? 'nächste ' + Math.round(t.nearest.d) + ' km' : 'tippen: laden'), dim: !t.jams }; }
      default: return { v: '–', u: '' };
    }
  }
  const ARROW = (h) => `<svg class="arrow" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><g transform="rotate(${h || 0} 22 22)"><path d="M22 5 L29 24 L22 20 L15 24 Z" fill="var(--acc)"/><path d="M22 39 L29 24 L22 20 L15 24 Z" fill="currentColor" fill-opacity=".3"/></g></svg>`;
  function renderTiles() {
    const box = $('#tiles');
    if (!S.tiles.length) { box.innerHTML = '<div id="empty">Nur Tempo. Sage „Alle Werte“ oder „Zeige Höhe“, oder öffne ⚙.</div>'; return; }
    let h = '';
    for (const id of S.tiles) {
      const sid = shownId(id), multi = grpOf(id).length > 1, t = tileData(sid);
      h += `<div class="tile${t.dim ? ' dim' : ''}${t.arrow != null ? ' rose' : ''}${id === 'tank' || id === 'stau' || multi ? ' tap' : ''}" data-id="${id}"><div class="l">${TNAME[sid]}${multi ? ' <i class="cy">⇄</i>' : ''}</div><div class="v">${t.arrow != null || sid === 'dir' ? ARROW(t.arrow) : ''}${t.v}${t.u ? `<small>${t.u}</small>` : ''}</div><div class="s">${t.s || '&nbsp;'}</div></div>`;
    }
    if (box._h !== h) { box.innerHTML = h; box._h = h; }
  }
  setInterval(() => { if (R.lat != null || S.tiles.includes('clock')) renderTiles(); }, 1000);


  // ---------- Werte für eigene Designs ----------
  function getVal(src) {
    const f = fu(), dk = S.unit === 'mph' ? MPH : 1, none = { n: null, t: '–' };
    const num = (x) => (x == null || !isFinite(x) ? none : { n: x });
    switch (src) {
      case 'speed': return { n: heroShown };
      case 'kmh': return { n: heroShown / f };
      case 'limit': return R.limit && R.limit.v != null ? { n: R.limit.v * f } : { n: null, t: R.limit && R.limit.kind === 'none' ? '∞' : '–' };
      case 'free': { const l = limitKmh(); return l == null ? none : { n: (l - R.speed) * f }; }
      case 'alt': return num(R.alt);
      case 'altnn': return num(altVals().nn);
      case 'altnap': return num(altVals().nap);
      case 'altell': return num(altVals().ell);
      case 'dir': return num(headingNow());
      case 'dirname': return { n: null, t: dirName(headingNow()) };
      case 'acc': return num(R.accel);
      case 'g': return num(R.g);
      case 'max': return { n: S.day.max * f };
      case 'avg': return S.trip.mt > 30000 ? { n: S.trip.dist / (S.trip.mt / 3600000) * f } : none;
      case 'time': return { n: null, t: hms(S.trip.mt) };
      case 'day': return { n: S.day.dist * dk };
      case 'trip': return { n: S.trip.dist * dk };
      case 'total': return { n: S.total * dk };
      case 'clock': { const d = new Date(); return { n: null, t: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }; }
      case 'date': return { n: null, t: new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) };
      case 'gps': return num(R.acc);
      case 'sat': return { n: null, t: R.sats ? R.sats.used + '/' + R.sats.visible : '–' };
      case 'temp': return R.wx ? { n: R.wx.temperature_2m } : none;
      case 'gust': return R.wx ? { n: R.wx.wind_gusts_10m * f } : none;
      case 'grade': return num(R.grade);
      case 'wind': return R.wx && R.wx.wind_speed_10m != null ? { n: R.wx.wind_speed_10m * f } : none;
      case 'winddir': return R.wx && R.wx.wind_direction_10m != null ? { n: null, t: dirName(R.wx.wind_direction_10m) } : none;
      case 'hum': return R.wx && R.wx.relative_humidity_2m != null ? { n: R.wx.relative_humidity_2m } : none;
      case 'feels': return R.wx && R.wx.apparent_temperature != null ? { n: R.wx.apparent_temperature } : none;
      case 'rain': return R.wx ? { n: R.wx.precipitation } : none;
      case 'wx': return R.wx ? { n: null, t: wxText(R.wx.weather_code) } : none;
      case 'ref': return { n: null, t: R.road && R.road.ref ? R.road.ref : '–' };
      case 'roadname': return { n: null, t: R.road ? (R.road.name || R.road.ref || '–') : ((R.qname && Date.now() - (R.qT || 0) < 20000) ? R.qname : '–') };
      case 'battery': return R.batt != null ? { n: R.batt } : none;
      case 'navdist': case 'navturn': case 'navstreet': case 'navremain': case 'navdur': case 'naveta': { const v = window.NavUI ? NavUI.vals()[src] : ''; return { n: null, t: v || '–' }; }
      case 'lat': return R.lat != null ? { n: null, t: R.lat.toFixed(5) } : none;
      case 'lon': return R.lon != null ? { n: null, t: R.lon.toFixed(5) } : none;
      default: return none;
    }
  }
  const wxText = (c) => c == null ? '–' : c === 0 ? 'Klar' : c <= 2 ? 'Heiter' : c === 3 ? 'Bewölkt' : c <= 48 ? 'Nebel' : c <= 57 ? 'Niesel' : c <= 67 ? 'Regen' : c <= 77 ? 'Schnee' : c <= 82 ? 'Schauer' : c <= 86 ? 'Schneeschauer' : 'Gewitter';
  try { if (navigator.getBattery) navigator.getBattery().then((b) => { const u = () => { R.batt = Math.round(b.level * 100); }; u(); b.addEventListener('levelchange', u); }); } catch (e) { /* egal */ }
  function designApi() {
    return { get: getVal, state: R.state, limit: R.limit, limitKmh: limitKmh(), fu: fu(), road: R.road, next: S.preview ? R.next : null, limitObj: R.limit, signHTML, nav: window.NavUI ? NavUI.navState() : null, navIcon: (st, o) => Nav.icon(st, o) };
  }
  const wantDesign = () => (isSplit() && S.dSplit) ? S.dSplit : (isLand() ? S.dLand : S.dPort);
  async function applyDesign() {
    const name = wantDesign(), b = document.body;
    if (!name) { if (cur) { cur = null; $('#custom').innerHTML = ''; } b.classList.remove('cd'); if (window.NavUI) NavUI.dock(); return; }
    if (cur && cur.name === name && cur.fill === isSplit()) { cur.m.layout(); return; }
    let d = null; try { d = await Design.Store.get(name); } catch (e) { /* kein Speicher */ }
    if (!d) { b.classList.remove('cd'); cur = null; return; }
    if (wantDesign() !== name) return;
    b.classList.add('cd'); const fill = isSplit(); cur = { name, d, fill, m: Design.mount($('#custom'), d, { fill }) };
    if (window.NavUI) NavUI.dock();
  }
  let designList = [];
  // Jedes gespeicherte Design wird zusätzlich in den Ordner Documents/Tacho-Designs geschrieben
  const mirrorDesign = (d) => (DFiles ? DFiles.save({ name: d.name, text: JSON.stringify(d) }).catch(() => null) : Promise.resolve(null));
  { const put0 = Design.Store.put; Design.Store.put = async (d) => { const r = await put0(d); mirrorDesign(d); return r; }; }
  // Mitgelieferte Navi-Designs (www/vorlagen) einmalig in die Design-Liste übernehmen
  const NAVI_TPL = ['Navi-Quer', 'Navi-Hochformat', 'Navi-Split-Hoch', 'Navi-Split-Quer', 'Tacho-Quer-Kacheln', 'Tacho-Navi-Links', 'Tacho-Navi-Band', 'Tacho-Navi-Hoch'];
  async function installNaviTpl(force) {
    if (!force && S.naviTpl === 2) return 0; let n = 0;
    for (const f of NAVI_TPL) { try { const r = await fetch('vorlagen/' + f + '.tacho.json'); if (!r.ok) continue; const d = Design.parse(await r.text()); delete d.warn; await Design.Store.put(d); n++; } catch (_) { /* weiter */ } }
    S.naviTpl = 2; save(true); return n;
  }
  setTimeout(() => installNaviTpl(false).then((n) => { if (n) toast('Neue Tacho-Designs sind da (Antippen wechselt die Werte): Einstellungen → Tacho-Designs.', 7000); }).catch(() => {}), 2500);
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.dz-navi') && window.NavUI) NavUI.show(); });
  async function exportAllDesigns() {
    const l = await Design.Store.list();
    if (!l.length) { toast('Noch keine Designs da', 3000); return; }
    if (DFiles) { let n = 0; for (const d of l) { if (await mirrorDesign(d)) n++; } toast(n + ' Designs im Ordner „Dokumente/Tacho-Designs“ gespeichert', 6000); return; }
    for (const d of l) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = d.name + '.tacho.json'; document.body.appendChild(a); a.click(); a.remove(); }
    toast(l.length + ' Dateien heruntergeladen', 5000);
  }
  async function importFolder() {
    if (DFiles) {
      const r = await DFiles.list(); let n = 0;
      for (const f of r.files || []) { try { const t = (await DFiles.read({ file: f })).text; await importText(t, true); n++; } catch (_) { /* weiter */ } }
      if (n) { toast(n + ' Designs aus dem Ordner geladen', 5000); return; }
      toast('Ordner leer oder nach Neuinstallation nicht lesbar. Bitte Dateien aus „Dokumente/Tacho-Designs“ wählen.', 7000);
    }
    const fs = await Creator.pickFile('.json,application/json', true); if (!fs) return; let n = 0;
    for (const f of [].concat(fs)) { try { await importText(await f.text(), true); n++; } catch (_) { /* weiter */ } }
    toast(n + ' Designs geladen', 4000);
  }
  async function loadDesigns() { try { designList = await Design.Store.list(); } catch (e) { designList = []; } if (!$('#sheet').hidden) buildPanel(); }
  function copyText(t, msg) { const ok = () => toast(msg, 6000); const fb = () => { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Kopieren nicht möglich, Text unten markieren', 5000); } x.remove(); }; if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, fb); else fb(); }
  // Vor dem Erstellen auswählen, was in den KI-Text soll
  function copyAi() {
    const o = Object.assign({}, Guide.DEF, S.aiOpt || {});
    const name = (k) => (Design.SRC.find((s) => s[0] === k) || [k, k])[1];
    const cb = (grp, k, l, on) => `<label class="aic"><input type="checkbox" data-grp="${grp}" value="${k}" ${on ? 'checked' : ''}> ${Design.esc(l)}</label>`;
    measureScr();
    const sc = S.scr || {}, g = (k, est, px) => sc[k] ? [String(sc[k].a), sc[k].w + '×' + sc[k].h, 'gemessen'] : [String(est), px, 'geschätzt'];
    const M = { land: g('land', 2.12, '2580×1220'), port: g('port', 0.47, '1220×2600'), splitP: g('splitP', 0.95, '1220×1280'), splitL: g('splitL', 1.06, '1290×1220') };
    const ASP = [
      [M.land[0], `Mein Handy quer (${M.land[1]}, ${M.land[2]})`, M.land[1]],
      [M.port[0], `Mein Handy hochkant (${M.port[1]}, ${M.port[2]})`, M.port[1]],
      [M.splitP[0], `Geteilter Bildschirm, Handy hochkant: obere oder untere Hälfte (${M.splitP[1]}, ${M.splitP[2]})`, M.splitP[1]],
      [M.splitL[0], `Geteilter Bildschirm, Handy quer: linke oder rechte Hälfte (${M.splitL[1]}, ${M.splitL[2]})`, M.splitL[1]],
      ['2.2230', 'Ganzer Bildschirm 20:9 ohne Leisten (2712×1220)', '2712×1220'],
      ['1.7778', 'Tablet quer 16:9', ''], ['1.3333', '4:3', '']];
    if (!ASP.some((x) => x[0] === o.aspect)) o.aspect = ASP[0][0];
    const ov = document.createElement('div'); ov.className = 'guide';
    ov.innerHTML = `<div class="gbox aibox"><h3>KI-Text erstellen</h3>
      <p class="ais">Wähle aus, was die KI einbauen soll. Nur ausgewählte Werte kommen in den Text, dadurch macht die KI weniger Fehler.</p>
      <h4>Format</h4><select id="aiAsp">${ASP.map(([v, l, px], i) => `<option value="${v}" data-px="${px}" data-i="${i}" ${o.aspect === v && (o.fmt == null || o.fmt === i) ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="ais">Tipp: Öffne die App einmal quer, hochkant und im geteilten Bildschirm, dann misst sie die genaue Größe.</p>
      <h4>Aussehen</h4>
      <label class="aic"><input type="radio" name="ailook" value="real" ${o.look === 'real' ? 'checked' : ''}> So echt wie möglich (Verläufe, Chrom, Leuchten)</label>
      <label class="aic"><input type="radio" name="ailook" value="flat" ${o.look === 'flat' ? 'checked' : ''}> Schlicht und klar</label>
      <label class="aic"><input type="radio" name="ailook" value="image" ${o.look === 'image' ? 'checked' : ''}> Mein Bild als Hintergrund, nur Werte darauf (pixelgenau)</label>
      <h4>Bauteile</h4>${Guide.PARTS.map(([k, l]) => cb('part', k, l, o.parts.includes(k))).join('')}
      ${Guide.GROUPS.map(([g, ks]) => `<h4>${g} <button class="mini" data-all="${ks.join(',')}">alle</button><button class="mini" data-none="${ks.join(',')}">keine</button></h4>` + ks.map((k) => cb('src', k, name(k), o.srcs.includes(k))).join('')).join('')}
      <h4>Farben (optional)</h4><input id="aiCol" placeholder="z. B. blau und orange, schwarzer Hintergrund" value="${Design.esc(o.colors)}">
      <h4>Weitere Wünsche (optional)</h4><textarea id="aiNotes" style="height:70px" placeholder="z. B. Tempo links groß, Uhrzeit rechts">${Design.esc(o.notes)}</textarea>
      <button class="act pri" data-g="copy">Text erstellen und kopieren</button><button class="act" data-g="show">Text anzeigen</button><button class="act" data-g="x">Schließen</button>
      <textarea id="aiOut" readonly style="display:none;height:35vh;margin-top:8px"></textarea></div>`;
    const read = () => {
      const q = (s) => [...ov.querySelectorAll(s)];
      const opt = ov.querySelector('#aiAsp').selectedOptions[0];
      const r = { aspect: opt.value, px: opt.dataset.px, fmt: +opt.dataset.i, split: +opt.dataset.i === 2 || +opt.dataset.i === 3, look: (ov.querySelector('input[name=ailook]:checked') || {}).value || 'real',
        srcs: q('input[data-grp=src]:checked').map((x) => x.value), parts: q('input[data-grp=part]:checked').map((x) => x.value),
        colors: ov.querySelector('#aiCol').value.trim(), notes: ov.querySelector('#aiNotes').value.trim() };
      r.orient = +r.aspect < 1 ? 'port' : 'land';
      if (r.parts.some((p) => p === 'gauge' || p === 'bar') && !r.srcs.includes('kmh')) r.srcs.push('kmh');
      if (!r.srcs.includes('speed')) r.srcs.unshift('speed');
      S.aiOpt = r; save(true); return r;
    };
    ov.onclick = (ev) => {
      const t = ev.target, g = t.dataset.g;
      if (t.dataset.all || t.dataset.none) { const on = !!t.dataset.all; (t.dataset.all || t.dataset.none).split(',').forEach((k) => { const c = ov.querySelector(`input[data-grp=src][value="${k}"]`); if (c) c.checked = on; }); return; }
      if (g === 'x' || t === ov) ov.remove();
      if (g === 'copy') copyText(Guide.ai(read()), 'KI-Text kopiert. In die KI einfügen, Bild dazu geben.');
      if (g === 'show') { const out = ov.querySelector('#aiOut'); out.style.display = ''; out.value = Guide.ai(read()); out.focus(); out.select(); }
    };
    document.body.appendChild(ov);
  }
  async function importText(t, quiet) { const d = Design.parse(t); const w = d.warn || []; delete d.warn; await Design.Store.put(d); await loadDesigns(); if (w.length && !quiet) setTimeout(() => toast('Design „' + d.name + '“ angepasst: ' + w.slice(0, 3).join(' · ') + (w.length > 3 ? ' … (+' + (w.length - 3) + ')' : ''), 9000), 400); d.warn = w; return d; }
  async function fetchDesigns() {
    const r = await fetch('https://api.github.com/repos/menne1977/Neues-GPS-/contents/designs'); if (!r.ok) throw new Error(r.status === 404 ? 'Auf dem Server liegen noch keine Designs' : 'HTTP ' + r.status);
    const files = (await r.json()).filter((x) => /\.tacho\.json$/.test(x.name)); let n = 0;
    for (const f of files) { const t = await (await fetch(f.download_url)).text(); await importText(t, true); n++; }
    return n;
  }
  function openCreator(name) {
    closeSheet();
    const go = (d) => Creator.open(d, { signHTML, toast }, async (dd) => { await loadDesigns(); if (cur && cur.name === dd.name) { cur = null; applyDesign(); } });
    if (name) Design.Store.get(name).then(go); else go(null);
  }
  loadDesigns();

  // ---------- Unterwegs, Navigation, andere Apps ----------
  const NAVI = { intern: 'dem eigenen Navi', google: 'Google Maps', sygic: 'Sygic', geo: 'einer anderen Karten-App', ask: 'Auswahl jedes Mal' };
  function navigateTo(o) {
    if (S.navi === 'intern' && window.NavUI) {
      if (o.lat != null) return NavUI.start({ lat: o.lat, lon: o.lon, name: o.name || 'Ziel' });
      if (o.query) return NavUI.go(o.query);
    }
    const a = Object.assign({ app: S.navi }, o);
    if (AppCtl) return AppCtl.navigate(a).catch((e) => toast('Navigation: ' + ((e && e.message) || e), 5000));
    const url = o.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lon}&travelmode=driving` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.query || '')}`;
    window.open(url, '_blank');
  }
  if (window.NavUI) NavUI.init({
    R, S, toast, save, hasNaviEl: () => !!(cur && cur.d && cur.d.els.some((e) => e.t === 'navi')), fetch: (u, o) => fetch(u, o), roads: () => engine.roads, heading: () => headingNow(),
    live: () => { const av = altVals(), h = headingNow(); return { speed: S.decimals ? fmt(R.speed * fu(), 1) : String(Math.round(R.speed * fu())), unit: uName(), limit: R.limit && R.limit.v != null ? String(Math.round(R.limit.v * fu())) : (R.limit && R.limit.kind === 'none' ? '∞' : '–'), alt: av.sel != null ? Math.round(av.sel) + ' m' : '–', altName: 'Höhe ' + ALTN[S.altRef], dir: h != null ? dirName(h) + ' ' + Math.round(h) + '°' : '–' }; },
    speak: (t, o) => { o = o || {}; if (Voice) Voice.speak({ text: t, pitch: o.pitch || 1, rate: o.rate || 1.02, voice: o.voice || '', volume: S.vol }).catch(() => {}); else if (window.speechSynthesis) { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'de-DE'; if (o.pitch) u.pitch = o.pitch; if (o.rate) u.rate = o.rate; if (o.voice) { const v = speechSynthesis.getVoices().find((x) => x.name === o.voice); if (v) u.voice = v; } speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* egal */ } } },
    voices: async () => { if (Voice) { const r = await Voice.voices(); return r.voices || []; } return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((v) => /^de/i.test(v.lang)).map((v) => ({ name: v.name, network: !v.localService, installed: true })); },
    jams: () => { if (S.online && Date.now() - (Places.P.jamT || 0) > 120000) placesApi.refresh(false); return Places.P.jams; }
  });
  $('#bNav').onclick = () => NavUI.show();
  const placesApi = { navigate: navigateTo, toast, refresh: (force) => Places.ensure(R.lat != null ? { lat: R.lat, lon: R.lon, heading: R.approx ? null : headingNow() } : (S.lp ? { lat: S.lp.lat, lon: S.lp.lon, heading: null } : null), S.fuelKm, !!force) };
  const errMsg = (e) => (e && e.message) || String(e);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let appsCache = null;
  async function appList() { if (!appsCache) appsCache = ((await AppCtl.apps()).list || []).sort((a, b) => a.l.localeCompare(b.l, 'de')); return appsCache; }
  async function needAcc() {
    if (!AppCtl) throw new Error('Das geht nur in der APK');
    const r = await AppCtl.accessEnabled();
    if (!r.enabled) throw new Error('Die Bedienungshilfe ist aus. Schalte unter Einstellungen, Apps „Tacho“ in den Android-Bedienungshilfen ein.');
  }
  const UI = (x) => needAcc().then(() => AppCtl.ui(x));
  async function doSplit(a) {
    if (!AppCtl) return 'Das geht nur in der APK.';
    if (a.off) { try { await UI({ action: 'split' }); return 'Geteilter Bildschirm beendet.'; } catch (e) { return errMsg(e); } }
    let pkg = S.splitApp.pkg, label = S.splitApp.label;
    if (a.name) {
      if (/navi|karte|maps/.test(a.name)) { pkg = S.navi === 'sygic' ? 'com.sygic.aura' : 'com.google.android.apps.maps'; label = NAVI[S.navi] || 'Navigation'; }
      else { const q = a.name.toLowerCase(), l = (await appList()).find((x) => x.l.toLowerCase().includes(q)); if (!l) return 'Ich finde keine App namens ' + a.name + '.'; pkg = l.p; label = l.l; }
    }
    if (!pkg) { openSheet('apps'); return 'Wähle zuerst die App für den geteilten Bildschirm.'; }
    let acc = false; try { acc = (await AppCtl.accessEnabled()).enabled; } catch (e) { /* egal */ }
    if (acc) { await AppCtl.ui({ action: 'split' }).catch(() => {}); await sleep(1000); }
    try { await AppCtl.adjacent({ pkg }); } catch (e) { return 'Die App ist nicht startbar: ' + errMsg(e); }
    return acc ? 'Geteilter Bildschirm mit ' + label + '.' : label + ' wird daneben geöffnet. Falls nichts passiert, schalte die Bedienungshilfe ein oder teile den Bildschirm über die App-Übersicht.';
  }
  // ---------- Telefon ----------
  let pickList = null;
  const spellNum = (n) => String(n).replace(/[^0-9+]/g, '').split('').join(' ').replace(/\+/g, 'plus');
  async function phoneAct(a) {
    if (!Phone) return 'Telefonieren geht nur in der APK.';
    const perm = await Phone.ensure().catch(() => ({ ok: false }));
    const dial = async (name, num) => { const r = await Phone.dial({ number: num }); return r.direct ? 'Ich rufe ' + name + ' an.' : 'Wähltastatur mit ' + name + ' geöffnet. Bitte grün drücken.'; };
    switch (a.a) {
      case 'hangup':
        try { await Phone.hangup(); return ''; } catch (e) { if (AppCtl && S.appCtl) { await AppCtl.ui({ action: 'click', text: 'Auflegen' }).catch(() => AppCtl.ui({ action: 'click', text: 'Beenden' })); return ''; } return 'Auflegen ist nicht erlaubt. Bitte die Telefon-Erlaubnis geben.'; }
      case 'answer':
        try { await Phone.answer(); return ''; } catch (e) { return 'Annehmen ist nicht erlaubt. Bitte die Telefon-Erlaubnis geben.'; }
      case 'dial': return dial(spellNum(a.number), a.number);
      case 'pick': {
        if (!pickList || !pickList.list[a.i]) return 'Es gibt keine Auswahl.';
        const c = pickList.list[a.i], mode = pickList.mode; pickList = null;
        return mode === 'number' ? c.name + ': ' + spellNum(c.number) : dial(c.name, c.number);
      }
      case 'recent': case 'callback': {
        const r = await Phone.recent().catch(() => null);
        const l = r && r.list || []; if (!l.length) return 'Ich kann die Anrufliste nicht lesen.';
        const c = l.find((x) => x.type === 3 || x.type === 1) || l[0];
        const who = c.name || spellNum(c.number);
        if (a.a === 'callback') return dial(who, c.number);
        return (c.type === 3 ? 'Verpasster Anruf von ' : 'Zuletzt ') + who + ', um ' + new Date(c.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + '. Sage „zurückrufen“.';
      }
      case 'call': case 'number': {
        if (!perm.ok) return 'Bitte erlaube der App Kontakte und Telefon, dann noch einmal sagen.';
        const r = await Phone.find({ name: a.name }).catch((e) => { throw new Error(errMsg(e)); });
        const l = (r.list || []);
        if (!l.length) return 'Ich finde ' + a.name + ' nicht in deinen Kontakten.';
        const top = l.filter((c) => c.score >= l[0].score - 2);
        const uniq = [...new Map(top.map((c) => [c.name, c])).values()];
        if (uniq.length > 1 || (top.length > 1 && new Set(top.map((c) => c.number.replace(/\D/g, ''))).size > 1)) {
          pickList = { mode: a.a, list: top.slice(0, 4) };
          return 'Welche? ' + pickList.list.map((c, i) => (i + 1) + ': ' + c.name + (c.type ? ' ' + c.type : '')).join(', ') + '. Sage die Nummer, zum Beispiel „die erste“.';
        }
        const c = l[0];
        return a.a === 'number' ? c.name + ' hat die Nummer ' + spellNum(c.number) + '.' : dial(c.name, c.number);
      }
    }
    return '';
  }
  function appAct(a) {
    if (!AppCtl && !/^nav/.test(a.act)) return Promise.resolve('Das geht nur in der APK.');
    const ok = (t) => () => t, bad = (t) => (e) => (t ? t : errMsg(e));
    switch (a.act) {
      case 'openapp': return a.navi ? AppCtl.launch({ name: S.navi === 'sygic' ? 'sygic' : 'maps' }).then((r) => 'Ich öffne ' + r.label + '.').catch(bad('Keine Navigations-App gefunden.'))
        : AppCtl.launch({ name: a.name }).then((r) => 'Ich öffne ' + r.label + '.').catch(bad('Ich finde keine App namens ' + a.name + '.'));
      case 'sys': if (a.a === 'front') return AppCtl.front().then(ok('Zurück zum Tacho.')); if (a.a === 'home') return AppCtl.home().then(ok('Startbildschirm.')); return UI({ action: a.a }).then(ok('Okay.')).catch(bad());
      case 'scroll': return UI({ action: a.down ? 'scroll_down' : 'scroll_up' }).then(ok('Gescrollt.')).catch(bad('Hier lässt sich nichts scrollen.'));
      case 'click': return UI({ action: 'click', text: a.text }).then(ok('Getippt auf ' + a.text + '.')).catch((e) => (/Bedienungshilfe/.test(errMsg(e)) ? errMsg(e) : 'Ich finde „' + a.text + '“ nicht auf dem Bildschirm.'));
      case 'type': return UI({ action: 'type', text: a.text }).then(ok('Geschrieben.')).catch((e) => (/Bedienungshilfe/.test(errMsg(e)) ? errMsg(e) : 'Kein Textfeld aktiv.'));
      case 'closeapp': return UI({ action: 'closeapp', name: a.name }).then((r) => ((r && r.label) || 'App') + ' beendet.').catch(bad());
      case 'media': return AppCtl.media({ key: a.key }).then(ok({ pause: 'Pause.', play: 'Weiter.', next: 'Nächster Titel.', prev: 'Vorheriger Titel.' }[a.key]));
      case 'sysvol': return AppCtl.volume({ dir: a.up ? 'up' : 'down' }).then(ok(a.up ? 'Lauter.' : 'Leiser.'));
      case 'split': return doSplit(a);
      case 'navto': if (S.navi === 'intern') return NavUI.go(a.q); navigateTo({ query: a.q }); return Promise.resolve('Navigation nach ' + a.q + ' gestartet.');
      case 'navopt': { const o = NavUI.opts(); const p = Object.assign({}, a.p || {}); if (a.add) p.scenic = o.scenic.includes(a.add) ? o.scenic : o.scenic.concat(a.add); NavUI.setOpt(p); return Promise.resolve(a.say || 'Eingestellt.'); }
      case 'naviorient': if (a.v === 'center') NavUI.recenter(); else NavUI.setOrient(a.v); return Promise.resolve(a.say);
      case 'navlook': NavUI.setLook(a.p); return Promise.resolve(a.say || 'Eingestellt.');
      case 'navjam': return Promise.resolve(a.yes ? NavUI.jamYes() : NavUI.jamNo());
      case 'navgo': return Promise.resolve(NavUI.prevGo(a.n));
      case 'navalt': return NavUI.altRoute();
      case 'navshare': return NavUI.shareEta();
      case 'navoffline': return a.name ? NavUI.startOffline(a.name) : NavUI.saveOffline();
      case 'navavoid': if (a.id === 'all') NavUI.setOpt({ avoid: [] }); else NavUI.setAvoid(a.id, a.on); return Promise.resolve(a.say || 'Eingestellt.');
      case 'navsave': return NavUI.saveHere(a.kind, a.label);
      case 'navwalk': return NavUI.walkOn();
      case 'navtheme': NavUI.setTheme(a.id); return Promise.resolve('Kartenfarbe ' + a.id + '.');
      case 'navzoom': if (a.d === 'in') NavUI.zoomIn(); else if (a.d === 'out') NavUI.zoomOut(); else NavUI.zoomAuto(); return Promise.resolve('Karte.');
      case 'navstop': return Promise.resolve(NavUI.stop(true));
      case 'navinfo': return Promise.resolve(NavUI.info());
      case 'navrepeat': return Promise.resolve(NavUI.repeat());
      case 'navshow': NavUI.show(); return Promise.resolve('Navigation.');
      default: return Promise.resolve('');
    }
  }
  $('#bPlaces').onclick = () => Places.show('fuel', placesApi);
  $('#bSplit').onclick = () => run({ act: 'split', name: '' });
  $('#tiles').addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (!t) return; { const g = grpOf(t.dataset.id); if (g.length > 1) { S.tix[t.dataset.id] = (((S.tix[t.dataset.id]) || 0) + 1) % g.length; save(true); renderTiles(); } } if (t.dataset.id === 'tank') Places.show('fuel', placesApi); if (t.dataset.id === 'stau') Places.show('jam', placesApi); });

  // ---------- Sprachsteuerung ----------
  let wasListening = false;
  const MIC = '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
  const SPK = '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4h4l5 4V6L7 10zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  function paintMic() {
    const b = $('#mic');
    b.classList.toggle('listen', !!R.mic.recording); b.classList.toggle('wakeon', S.wake);
    b.innerHTML = R.mic.speaking ? SPK : MIC;
  }
  function wakeWords() { return S.wakeWord === 'tacho' ? ['tacho', 'tacko', 'tako', 'taco'] : [S.wakeWord]; }
  async function startWake() {
    if (!Voice) { toast('Aktivierungswort gibt es nur in der APK'); return false; }
    try {
      await Voice.setWake({ words: wakeWords() });
      await Voice.listen();
      if (AppCtl) AppCtl.keepAlive({ on: true }).catch(() => {});
      return true;
    } catch (e) { toast('Mikrofon: ' + ((e && e.message) || e), 6000); S.wake = false; return false; }
  }
  function stopWake() { if (Voice) Voice.stopListening().catch(() => {}); if (AppCtl) AppCtl.keepAlive({ on: false }).catch(() => {}); }
  if (Voice) {
    Voice.addListener('speech', (d) => heard(d.text, d.alts));
    Voice.addListener('wake', () => toast('Ich höre …', 2500));
    Voice.addListener('state', (d) => { R.mic = Object.assign(R.mic, { listening: !!d.listening, recording: !!d.recording, speaking: !!d.speaking }); if (d.error) toast('Mikrofon: ' + d.error, 5000); paintMic(); });
  }
  let webRec = null;
  function listenOnce() {
    if (Voice) { Voice.listenOnce().catch((e) => toast('Mikrofon: ' + ((e && e.message) || e), 6000)); toast('Ich höre zu …', 2500); return; }
    const WR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!WR) { toast('Hier keine Spracherkennung. Befehl unter ⚙ eintippen.'); openSheet('cmd'); return; }
    webRec = new WR(); webRec.lang = 'de-DE'; webRec.maxAlternatives = 3;
    webRec.onresult = (e) => { const r = e.results[0]; heard(r[0].transcript, [...r].map((x) => x.transcript)); };
    webRec.onend = () => { R.mic.recording = false; paintMic(); };
    R.mic.recording = true; paintMic(); try { webRec.start(); } catch (e) { /* läuft schon */ }
  }
  // Tippen = einmal sprechen. Lange drücken = Aktivierungswort an/aus.
  (function () {
    const b = $('#mic'); let t = 0, long = false;
    b.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; run({ act: 'toggle', key: 'wake', on: !S.wake }); }, 700); });
    b.addEventListener('pointerup', () => { clearTimeout(t); if (!long) listenOnce(); });
    b.addEventListener('pointerleave', () => clearTimeout(t));
  })();

  function heard(text, alts) {
    const list = [text].concat(alts || []).filter(Boolean);
    for (const x of list) { const a = Cmd.parse(x); if (a) { toast('„' + x + '“', 1800); return run(a); } }
    say('Das habe ich nicht verstanden. Sage Hilfe für Beispiele.');
  }

  // ---------- Befehle ausführen ----------
  function answer(what) {
    const t = tileData(what);
    switch (what) {
      case 'limit': {
        const l = R.limit; if (!R.road || !l) return 'Ich kenne die Straße noch nicht.';
        const u = Math.round((l.v || 0) * fu()) + ' ' + (S.unit === 'mph' ? 'Meilen pro Stunde' : 'Kilometer pro Stunde');
        const nm = R.road.name ? ' auf ' + R.road.name : '';
        let s;
        if (l.kind === 'none') s = 'Hier ist kein Limit erfasst' + nm + '.';
        else if (l.kind === 'advisory') s = 'Auf der Autobahn gilt die Richtgeschwindigkeit ' + u + ', ein Limit ist nicht erfasst.';
        else if (l.v == null) s = 'Hier gilt eine wechselnde Anzeige.';
        else if (l.kind === 'default') s = 'Hier gelten vermutlich ' + u + nm + '. Ein Schild ist nicht erfasst.';
        else s = 'Hier sind ' + u + ' erlaubt' + nm + '.';
        if (l.note) s += ' ' + l.note + '.';
        if (R.next && R.next.limit.v != null) s += ' In ' + Math.round(R.next.dist / 10) * 10 + ' Metern ' + Math.round(R.next.limit.v * fu()) + '.';
        return s;
      }
      case 'speed': return 'Du fährst ' + Math.round(R.speed * fu()) + ' ' + (S.unit === 'mph' ? 'Meilen pro Stunde' : 'Kilometer pro Stunde') + '.';
      case 'alt': { const av = altVals(); return av.sel == null ? 'Die Höhe ist noch nicht bekannt.' : 'Du bist auf ' + Math.round(av.sel) + ' Metern über ' + (S.altRef === 'nap' ? 'N A P' : S.altRef === 'ell' ? 'dem Ellipsoid' : 'Normalnull') + '.'; }
      case 'clock': { const d = new Date(); return 'Es ist ' + d.getHours() + ' Uhr ' + String(d.getMinutes()).padStart(2, '0') + '.'; }
      case 'dir': { const h = headingNow(); return h == null ? 'Die Richtung ist noch nicht bekannt.' : 'Du fährst Richtung ' + dirLong(h) + '.'; }
      case 'wx': return R.wx ? `Draußen sind es ${Math.round(R.wx.temperature_2m)} Grad, ${WX[R.wx.weather_code] || ''}.` : 'Das Wetter ist noch nicht geladen.';
      case 'day': return 'Heute ' + km(S.day.dist) + ' ' + (S.unit === 'mph' ? 'Meilen' : 'Kilometer') + '.';
      case 'time': return 'Fahrzeit im Trip: ' + hms(S.trip.mt) + ' Stunden.';
      default: return TNAME[what] + ': ' + t.v + ' ' + (t.u || '') + '.';
    }
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SW_TEXT = { beep: 'Warnton', warnSpeak: 'Warnansage', announce: 'Limit-Ansage', replies: 'Sprachantworten', wake: 'Aktivierungswort', awake: 'Bildschirm anlassen', online: 'Online-Modus', preview: 'Limit-Vorschau', decimals: 'Nachkommastelle', wxOn: 'Wetter', satOn: 'Satelliten', bt: 'Bluetooth-Mikrofon', navVoice: 'Navi-Ansagen', appCtl: 'Andere Apps per Sprache bedienen' };

  function run(a) {
    let msg = '';
    switch (a.act) {
      case 'help': msg = 'Du kannst zum Beispiel sagen: Wie schnell darf ich fahren? Zeige Höhe. Nur Tempo. Thema Neon. Querformat. Toleranz fünf. Alle Befehle stehen in den Einstellungen.'; openSheet('cmd'); break;
      case 'ask': msg = answer(a.what); break;
      case 'tile': {
        if (a.on && !S.tiles.includes(a.id)) S.tiles.push(a.id);
        if (!a.on) S.tiles = S.tiles.filter((x) => x !== a.id);
        msg = TNAME[a.id] + (a.on ? ' eingeblendet.' : ' ausgeblendet.');
        break;
      }
      case 'only': S.tiles = []; msg = 'Nur Tempo.'; break;
      case 'all': S.tiles = TILES.map((t) => t[0]); msg = 'Alle Werte sind sichtbar.'; break;
      case 'default': S.tiles = DEFTILES.slice(); S.theme = 'nacht'; S.accent = DEF.accent; S.hero = 1; S.tsize = 1; msg = 'Standardansicht.'; break;
      case 'move': { const i = S.tiles.indexOf(a.id); if (i < 0) { msg = 'Die Kachel ist nicht sichtbar.'; break; } const j = clamp(i + a.dir, 0, S.tiles.length - 1); S.tiles.splice(j, 0, S.tiles.splice(i, 1)[0]); msg = 'Verschoben.'; break; }
      case 'layout': S.layout = a.id; applyOrient(); msg = a.id === 'land' ? 'Querformat.' : a.id === 'port' ? 'Hochformat.' : 'Automatisch drehen.'; break;
      case 'cols': if (isLand()) S.colsL = a.n; else S.colsP = a.n; msg = a.n + ' Spalten.'; break;
      case 'size': if (a.what === 'hero') S.hero = clamp(+(S.hero + a.delta).toFixed(2), 0.6, 1.6); else S.tsize = clamp(+(S.tsize + a.delta).toFixed(2), 0.6, 1.8); msg = a.delta > 0 ? 'Größer.' : 'Kleiner.'; break;
      case 'theme': S.theme = a.id; msg = 'Thema ' + a.id + '.'; break;
      case 'accent': S.accent = a.color; msg = 'Akzentfarbe ' + a.name + '.'; break;
      case 'altref': S.altRef = a.id; S.day.altMin = S.day.altMax = null; msg = 'Höhe über ' + (a.id === 'nap' ? 'Amsterdamer Null' : a.id === 'ell' ? 'dem Ellipsoid' : 'Normalnull') + '.'; break;
      case 'unit': S.unit = a.id; heroTarget = R.speed * fu(); msg = a.id === 'mph' ? 'Meilen pro Stunde.' : 'Kilometer pro Stunde.'; break;
      case 'tol': S.tol = a.n; msg = a.n ? 'Toleranz ' + a.n + ' Kilometer pro Stunde.' : 'Keine Toleranz.'; break;
      case 'volume': S.vol = a.n != null ? a.n : clamp(S.vol + a.delta, 10, 100); msg = 'Lautstärke ' + S.vol + ' Prozent.'; break;
      case 'vehicle': S.veh = a.id; engine.cur = null; updateLimit(); msg = 'Fahrzeug: ' + L.VEHICLES[a.id].name + '.'; break;
      case 'trailer': S.veh = a.on ? (S.veh === 'motorrad' ? 'motoranhaenger' : 'gespann') : (S.veh === 'motoranhaenger' ? 'motorrad' : 'auto'); updateLimit(); msg = 'Fahrzeug: ' + L.VEHICLES[S.veh].name + '.'; break;
      case 'toggle': {
        S[a.key] = a.on; msg = SW_TEXT[a.key] + (a.on ? ' an.' : ' aus.');
        if (a.key === 'wake') { if (a.on) startWake().then((ok) => { if (!ok) { S.wake = false; paintMic(); } }); else stopWake(); }
        if (a.key === 'awake') applyAwake();
        if (a.key === 'online' && a.on) { engine.lastTry = 0; fetchStuff(); }
        if (a.key === 'satOn') startSats();
        if (a.key === 'bt' && AppCtl) AppCtl.bt({ on: a.on }).catch(() => {});
        if (a.key === 'appCtl' && a.on && AppCtl) AppCtl.accessEnabled().then((r) => { if (!r.enabled) { AppCtl.openAccessSettings(); toast('Schalte hier „Tacho“ ein. Auf neueren Androiden vorher in den App-Infos „Eingeschränkte Einstellungen zulassen“ wählen.', 9000); } }).catch(() => {});
        if (a.key === 'decimals') heroTarget = R.speed * fu();
        break;
      }
      case 'wakeword': S.wakeWord = a.word; msg = 'Aktivierungswort ist jetzt ' + a.word + '. Teste es mit dem Aktivierungswort an.'; if (S.wake && Voice) Voice.setWake({ words: wakeWords() }).catch(() => {}); break;
      case 'reset':
        if (a.what === 'day') { S.day.dist = 0; msg = 'Tageskilometer auf null.'; }
        if (a.what === 'trip') { S.trip = { dist: 0, mt: 0, max: 0 }; msg = 'Trip auf null.'; }
        if (a.what === 'max') { S.day.max = 0; S.trip.max = 0; msg = 'Höchsttempo zurückgesetzt.'; }
        if (a.what === 'avg') { S.trip.mt = 0; msg = 'Fahrzeit und Durchschnitt zurückgesetzt.'; }
        if (a.what === 'total') { S.total = 0; msg = 'Gesamtstrecke auf null.'; }
        break;
      case 'settings': if (a.open) openSheet(); else closeSheet(); msg = a.open ? 'Einstellungen.' : 'Geschlossen.'; break;
      case 'places': Places.show(a.tab, placesApi); msg = a.tab === 'fuel' ? 'Tankstellen in der Nähe. Antippen startet die Navigation.' : 'Autobahn-Meldungen.'; break;
      case 'settotal': S.total = a.n; msg = 'Gesamtkilometer ' + a.n + '.'; break;
      case 'navi': S.navi = a.id; msg = 'Navigation mit ' + NAVI[a.id] + '.'; break;
      case 'phone': phoneAct(a).then((t) => { if (t) say(t); }).catch((e) => say(errMsg(e))); break;
      case 'openapp': case 'closeapp': case 'sys': case 'scroll': case 'click': case 'type': case 'media': case 'sysvol': case 'split': case 'navto': case 'navopt': case 'navstop': case 'navinfo': case 'navrepeat': case 'navshow': case 'navsave': case 'navwalk': case 'navtheme': case 'navzoom': case 'navavoid': case 'naviorient': case 'navoffline': case 'navalt': case 'navshare': case 'navlook': case 'navjam': case 'navgo':
        if (!['sys', 'media', 'sysvol', 'openapp'].includes(a.act) && !/^nav/.test(a.act) && !S.appCtl && a.act !== 'split') { msg = 'Schalte zuerst unter Einstellungen, Apps „Andere Apps per Sprache bedienen“ ein.'; break; }
        appAct(a).then((t) => { if (t) say(t); }).catch((e) => say(errMsg(e)));
        break;
      default: return;
    }
    save(true); applyLook(); render(); if (!$('#sheet').hidden) buildPanel();
    if (msg) say(msg);
  }
  window.__run = run; // zum Testen

  // ---------- Satelliten ----------
  function startSats() {
    if (!Gnss) return;
    if (S.satOn) { Gnss.start().catch(() => {}); } else { Gnss.stop().catch(() => {}); R.sats = null; }
  }
  if (Gnss) Gnss.addListener('gnss', (d) => { R.sats = d; });

  // ---------- Einstellungen ----------
  function openSheet(sec) { $('#sheet').hidden = false; buildPanel(sec); }
  function closeSheet() { $('#sheet').hidden = true; }
  $('#gear').onclick = () => openSheet();
  $('#panel').addEventListener('toggle', (e) => { const d = e.target; if (d.tagName !== 'DETAILS' || !d.open) return; const b = d.querySelector('.sbody'); if (b && !b.firstChild && secFns[d.id]) b.innerHTML = secFns[d.id](); }, true);
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  const chk = (k, label, hint) => `<div class="row"><label>${label}${hint ? `<small>${hint}</small>` : ''}</label><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}></div>`;
  const sel = (k, label, opts) => `<div class="row"><label>${label}</label><select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(S[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const secFns = {};
  function buildPanel(open) {
    const keep = $('#panel').scrollTop;
    const openIds = open ? [open] : [...document.querySelectorAll('#panel details[open]')].map((d) => d.id);
    const det = (id, title, body) => { secFns[id] = body; return `<details id="${id}" ${openIds.includes(id) ? 'open' : ''}><summary>${title}</summary><div class="sbody">${openIds.includes(id) ? body() : ''}</div></details>`; };
    const vis = TILES.map(([id, name]) => ({ id, name, on: S.tiles.includes(id) }));
    const order = S.tiles.map((id) => vis.find((v) => v.id === id)).concat(vis.filter((v) => !v.on));
    let h = `<h2>Einstellungen <button class="btn" data-do="close">✕</button></h2>`;
    h += det('look', 'Anzeige', () => `
      ${sel('theme', 'Thema', [['nacht', 'Nacht'], ['schwarz', 'Schwarz (OLED)'], ['tag', 'Tag (hell)'], ['neon', 'Neon'], ['rot', 'Rot (Nachtsicht)'], ['blau', 'Blau']])}
      <div class="row"><label>Akzentfarbe</label><span>${Object.entries({ grün: '#3ddc97', blau: '#4aa3ff', orange: '#ff9f2e', rot: '#ff4d4d', gelb: '#ffd84f', pink: '#ff5fd2', türkis: '#2ee6d6', weiß: '#f2f5f8' }).map(([n, c]) => `<span class="sw" data-accent="${c}" style="background:${c};${S.accent === c ? 'border-color:#fff' : ''}" title="${n}"></span>`).join('')}</span></div>
      ${sel('layout', 'Ausrichtung', [['auto', 'Automatisch drehen'], ['land', 'Immer quer'], ['port', 'Immer hochkant']])}
      ${sel('unit', 'Einheit', [['kmh', 'km/h'], ['mph', 'mph']])}
      ${chk('decimals', 'Tempo mit Nachkommastelle')}
      <div class="row"><label>Tempo-Größe</label><input type="range" min="0.6" max="1.6" step="0.05" value="${S.hero}" data-k="hero"></div>
      <div class="row"><label>Kachel-Größe</label><input type="range" min="0.6" max="1.8" step="0.05" value="${S.tsize}" data-k="tsize"></div>
      ${sel('colsP', 'Spalten hochkant', [1, 2, 3, 4].map((n) => [n, n]))}
      ${sel('colsL', 'Spalten quer', [1, 2, 3, 4, 5].map((n) => [n, n]))}
      ${chk('awake', 'Bildschirm anlassen')}`);
    h += det('tilesec', 'Werte (Kacheln)', () => `<div class="info">Häkchen = sichtbar. Pfeile verschieben. Oder per Sprache: „Zeige Höhe“, „Verstecke Trip“.</div>` +
      order.map((v) => `<div class="tl"><label><input type="checkbox" data-tile="${v.id}" ${v.on ? 'checked' : ''}> ${v.name}</label>${v.on && v.id !== 'tank' && v.id !== 'stau' ? `<button class="mv" data-grp="${v.id}" title="Mehrere Werte auf dieser Kachel">⇄ ${grpOf(v.id).length}</button>` : ''}${v.on ? `<button class="mv" data-mv="${v.id}" data-d="-1">↑</button><button class="mv" data-mv="${v.id}" data-d="1">↓</button>` : ''}</div>${grpOpen === v.id ? `<div class="gm"><div class="info">Diese Kachel zeigt der Reihe nach (Antippen wechselt):</div>${TILES.filter((q) => q[0] !== 'tank' && q[0] !== 'stau').map((q) => `<label class="gml"><input type="checkbox" data-gm="${v.id}|${q[0]}" ${grpOf(v.id).includes(q[0]) ? 'checked' : ''}> ${q[1]}</label>`).join('')}<button class="mv" data-grp0="${v.id}">Standard</button></div>` : ''}`).join(''));
    h += det('lim', 'Tempolimit', () => `
      ${sel('veh', 'Fahrzeug', Object.entries(L.VEHICLES).map(([k, v]) => [k, v.name]))}
      <div class="row"><label>Toleranz (km/h)<small>bis hierhin nur gelbe Warnung</small></label><input type="number" min="0" max="30" data-k="tol" value="${S.tol}" style="width:80px"></div>
      ${chk('beep', 'Warnton bei zu schnell')}${chk('warnSpeak', 'Warnung zusätzlich ansagen')}${chk('announce', 'Neues Limit ansagen')}${chk('preview', 'Nächstes Limit voraus zeigen')}
      <div class="info">Das Limit kommt aus OpenStreetMap, passend zur Fahrtrichtung und Uhrzeit. Ein gestrichelter Rand mit ~ heißt: kein Schild erfasst, es ist ein Richtwert (50 innerorts, 100 außerorts). Das echte Schild gilt immer.</div>`);
    h += det('voice', 'Sprache', () => `
      ${chk('wake', 'Aktivierungswort immer bereit', 'Mikrofon-Knopf lange drücken schaltet auch um')}
      <div class="row"><label>Aktivierungswort</label><input type="text" id="wakeWord" value="${S.wakeWord}" style="width:140px"></div>
      ${chk('replies', 'Antworten sprechen')}${chk('navVoice', 'Navi-Ansagen')}
      <div class="row"><label>Lautstärke</label><input type="range" min="10" max="100" step="5" value="${S.vol}" data-k="vol"></div>
      ${chk('bt', 'Bluetooth-Headset als Mikrofon')}
      <div class="info">Tippe auf 🎙 und sprich, oder sage das Aktivierungswort. Die Erkennung braucht Internet und das deutsche Sprachpaket der Google-App.</div>`);
    h += det('data', 'Daten und Sensoren', () => `
      ${chk('online', 'Online gehen', 'Straßen, Limit, Wetter. Aus = nur GPS und Sensoren')}
      ${chk('wxOn', 'Wetter laden')}${chk('satOn', 'GPS-Satelliten lesen')}`);
    h += det('cmd', 'Sprachbefehle und Test', () => `
      <div class="row"><input type="text" id="cmdIn" placeholder="Befehl eintippen, z. B. Thema Neon" style="max-width:none;width:100%"><button class="btn" data-do="cmdgo">▶</button></div>
      <ul class="cmd">${Cmd.HELP.map((x) => `<li>${x}</li>`).join('')}</ul>`);
    h += det('designs', 'Tacho-Designs (eigene Tachos)', () => `
      ${sel('dLand', 'Tacho quer', [['', 'Kacheln (Standard)']].concat(designList.map((d) => [d.name, d.name])))}
      ${sel('dSplit', 'Tacho im geteilten Bildschirm', [['', 'wie quer/hochkant']].concat(designList.map((d) => [d.name, d.name])))}
      ${sel('dPort', 'Tacho hochkant', [['', 'Kacheln (Standard)']].concat(designList.map((d) => [d.name, d.name])))}
      <div class="row"><label>Navi im Tacho<small>Pfeil, Entfernung und Straße bei laufender Route</small></label><select data-nl="dock">${[['oben', 'Leiste oben im Tacho'], ['unten', 'Leiste unten im Tacho'], ['fenster', 'Schwebendes Fenster'], ['design', 'Nur im eigenen Design (Navi-Element)'], ['aus', 'Aus']].map(([v, t]) => `<option value="${v}" ${window.NavUI && NavUI.look().dock === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="info">Tipp: Im Creator gibt es das Element „Navi-Anzeige“. Steckt es im Design, erscheint das Navi genau dort.</div>
      <button class="act pri" data-do="dnew">Eigenen Tacho erstellen</button>
      <button class="act" data-do="gguide">Anleitung</button>
      <button class="act" data-do="gai">KI-Text kopieren (für andere KI)</button>
      <button class="act" data-do="dpaste">Design-Text einfügen (von KI)</button>
      <button class="act" data-do="dload">Design-Datei laden (.tacho.json)</button>
      <button class="act pri" data-do="dnavi">Navi-Designs verwenden (Quer, Hochformat, Split)</button>
      <button class="act pri" data-do="dexpall">Alle Tachos in Ordner speichern (Dokumente/Tacho-Designs)</button>
      <button class="act" data-do="dfolder">Tachos aus Ordner laden</button>
      <button class="act" data-do="dserver">Designs vom Server holen</button>
      ${designList.map((d) => `<div class="tl"><label>${Design.esc(d.name)}</label><button class="mv" style="width:auto;padding:0 8px" data-do="dedit" data-n="${Design.esc(d.name)}">Bearbeiten</button><button class="mv" style="width:auto;padding:0 8px" data-do="dexp" data-n="${Design.esc(d.name)}">Export</button><button class="mv" data-do="ddel" data-n="${Design.esc(d.name)}">✕</button></div>`).join('')}
      <div class="info">Jeder Tacho wird automatisch auch im Ordner Dokumente/Tacho-Designs gespeichert (bleibt nach Neuinstallation erhalten). Ein Design ist eine Datei. Du kannst sie laden, ohne die App neu zu bauen. Schicke mir Bilder mit Beschriftung, ich mache daraus Dateien, oder baue selbst im Creator.</div>`);
    h += det('apps', 'Apps, Split-Bildschirm, Navigation', () => `
      ${chk('appCtl', 'Andere Apps per Sprache bedienen', 'öffnen, schließen, zurück, tippen, scrollen, schreiben')}
      <button class="act" data-do="phoneperm">Telefon und Kontakte erlauben</button>
      <button class="act" data-do="accopen">Bedienungshilfe prüfen und öffnen</button>
      <div class="row"><label>App für den geteilten Bildschirm<small>${S.splitApp.label ? Design.esc(S.splitApp.label) : 'noch keine gewählt'}</small></label><button class="mv" style="width:auto;padding:0 10px" data-do="appsload">Wählen</button></div>
      <div id="applist" class="applist"></div>
      <div class="row"><label>Erste Navi-Ansage vor dem Abbiegen</label><select data-nl="ann">${[['250', '250 m'], ['500', '500 m'], ['750', '750 m'], ['1000', '1 km'], ['auto', 'Nach Tempo']].map(([v, t]) => `<option value="${v}" ${window.NavUI && String(NavUI.look().ann) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${sel('navi', 'Navigation', [['intern', 'Eigenes Navi (in der App)'], ['google', 'Google Maps'], ['sygic', 'Sygic'], ['geo', 'Andere Karten-App'], ['ask', 'Jedes Mal fragen']])}
      <div class="row"><label>Tankstellen-Umkreis (km)</label><input type="number" min="1" max="100" data-k="fuelKm" value="${S.fuelKm}" style="width:80px"></div>
      <div class="info">Geteilter Bildschirm: Knopf ◫ oben oder „Split mit Navigation“. Mit eingeschalteter Bedienungshilfe teilt die App den Bildschirm selbst, sonst öffnet sie die Wunsch-App daneben.</div>`);
    h += det('altsec', 'Höhe', () => `
      ${sel('altRef', 'Höhe anzeigen über', [['nn', 'Normalnull (NN, wie auf Karten)'], ['nap', 'Amsterdamer Null (NAP)'], ['ell', 'Ellipsoid (rohe GPS-Höhe, WGS84)']])}
      <div class="row"><label>NAP-Unterschied (m)<small>NAP = NN minus dieser Wert, normal 0</small></label><input type="number" step="0.01" data-k="napOff" value="${S.napOff}" style="width:80px"></div>
      <div class="info">NN ist die Höhe über dem Meer wie in Deutschland üblich. NAP ist der Bezug aus Amsterdam, fast gleich. Das Ellipsoid ist die Höhe über dem Rechenmodell der Erde, sie liegt bei uns rund 45 m höher. Per Sprache: „Höhe über NAP“, „Höhe über Normalnull“, „Höhe Ellipsoid“.</div>`);
    h += det('reset', 'Zähler', () => `
      <div class="row"><label>Gesamtkilometer<small>Zähler setzen, z. B. auf den Tachostand</small></label><input type="number" id="totalIn" value="${Math.round(S.total)}" style="width:110px"></div>
      <button class="act" data-do="rday">Tageskilometer auf null</button><button class="act" data-do="rtrip">Trip auf null</button><button class="act" data-do="rmax">Höchsttempo zurücksetzen</button><button class="act" data-do="rall">Alle Einstellungen zurücksetzen</button>`);
    h += `<div class="info">Quellen: OpenStreetMap-Mitwirkende (ODbL) für Straßen und Limits, Open-Meteo für Wetter.</div>`;
    $('#panel').innerHTML = h;
    $('#panel').scrollTop = keep;
  }

  $('#panel').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.nl && window.NavUI) { NavUI.setLook({ [t.dataset.nl]: t.value }); return; }
    if (t.dataset.k) {
      const k = t.dataset.k; let v = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number' || ['colsP', 'colsL'].includes(k) ? +t.value : t.value);
      if (t.type === 'checkbox') return run({ act: 'toggle', key: k, on: v });
      S[k] = v;
      if (k === 'layout') applyOrient();
      if (k === 'unit') heroTarget = R.speed * fu();
      if (k === 'veh') { engine.cur = null; updateLimit(); }
    } else if (t.dataset.gm) {
      const [tid, mid] = t.dataset.gm.split('|'); let g = grpOf(tid).slice();
      if (t.checked) { if (!g.includes(mid)) g.push(mid); } else g = g.filter((x) => x !== mid);
      if (!g.length) g = [tid];
      S.tcyc[tid] = g; S.tix[tid] = 0;
    } else if (t.dataset.tile) {
      const id = t.dataset.tile; if (t.checked) { if (!S.tiles.includes(id)) S.tiles.push(id); } else S.tiles = S.tiles.filter((x) => x !== id);
    } else if (t.id === 'totalIn') { S.total = Math.max(0, +t.value || 0); toast('Gesamtkilometer: ' + Math.round(S.total)); }
    else if (t.id === 'wakeWord') {
      const w = t.value.toLowerCase().replace(/[^a-zäöüß]/g, ''); if (w.length >= 3) { S.wakeWord = w; if (S.wake && Voice) Voice.setWake({ words: wakeWords() }).catch(() => {}); toast('Aktivierungswort: ' + w); } else toast('Mindestens 3 Buchstaben');
    } else return;
    save(true); applyLook(); render(); buildPanel();
  });
  $('#panel').addEventListener('click', (e) => {
    const t = e.target.closest('[data-do],[data-mv],[data-accent],[data-pkg],[data-grp],[data-grp0]'); if (!t) return;
    if (t.dataset.grp) { grpOpen = grpOpen === t.dataset.grp ? null : t.dataset.grp; return buildPanel('tilesec'); }
    if (t.dataset.grp0) { delete S.tcyc[t.dataset.grp0]; S.tix[t.dataset.grp0] = 0; save(true); renderTiles(); return buildPanel('tilesec'); }
    if (t.dataset.pkg) { S.splitApp = { label: t.dataset.l, pkg: t.dataset.pkg }; save(true); toast('Split-App: ' + t.dataset.l); return buildPanel('apps'); }
    if (t.dataset.accent) { S.accent = t.dataset.accent; save(true); applyLook(); render(); return buildPanel(); }
    if (t.dataset.mv) { const i = S.tiles.indexOf(t.dataset.mv), j = clamp(i + +t.dataset.d, 0, S.tiles.length - 1); S.tiles.splice(j, 0, S.tiles.splice(i, 1)[0]); save(true); render(); return buildPanel(); }
    const d = t.dataset.do;
    if (d === 'close') closeSheet();
    if (d === 'phoneperm') { if (!Phone) toast('Nur in der APK'); else Phone.ensure().then((r) => toast(r.ok ? 'Telefon und Kontakte erlaubt' : 'Nicht erlaubt. In den App-Infos unter Berechtigungen freigeben.', 6000)); }
    if (d === 'dnew') openCreator(null);
    if (d === 'gguide') { const o = document.createElement('div'); o.className = 'guide'; o.innerHTML = '<div class="gbox">' + Guide.html() + '<button class="act pri" data-g="ai">KI-Text kopieren</button><button class="act" data-g="x">Schließen</button></div>'; o.onclick = (ev) => { const g = ev.target.dataset.g; if (g === 'x' || ev.target === o) o.remove(); if (g === 'ai') copyAi(); }; document.body.appendChild(o); }
    if (d === 'gai') copyAi();
    if (d === 'dpaste') { const o = document.createElement('div'); o.className = 'guide'; o.innerHTML = '<div class="gbox"><h3>Design-Text einfügen</h3><textarea id="gpaste" placeholder="Hier den Text der KI einfügen"></textarea><button class="act pri" data-g="ok">Laden</button><button class="act" data-g="x">Abbrechen</button></div>'; o.onclick = async (ev) => { const g = ev.target.dataset.g; if (g === 'x') o.remove(); if (g === 'ok') { try { const dd = await importText($('#gpaste').value); o.remove(); toast('Design geladen: ' + dd.name + '. Jetzt oben auswählen.', 6000); buildPanel('designs'); } catch (er) { toast('Das ist kein gültiges Design: ' + errMsg(er), 7000); } } }; document.body.appendChild(o); }
    if (d === 'dnavi') installNaviTpl(true).then(() => { S.dLand = 'Navi Quer'; S.dPort = 'Navi Hochformat'; S.dSplit = isLand() ? 'Navi Split Quer' : 'Navi Split Hoch'; save(true); location.reload(); }).catch((er) => toast(errMsg(er), 6000));
    if (d === 'dexpall') exportAllDesigns().catch((er) => toast(errMsg(er), 6000));
    if (d === 'dfolder') importFolder().catch((er) => toast(errMsg(er), 6000));
    if (d === 'dedit') openCreator(t.dataset.n);
    if (d === 'dload') Creator.pickFile('.json,application/json').then(async (f) => { if (!f) return; try { const dd = await importText(await f.text()); toast('Design geladen: ' + dd.name); } catch (er) { toast('Fehler: ' + errMsg(er), 6000); } });
    if (d === 'dserver') { toast('Hole Designs …', 6000); fetchDesigns().then((n) => toast(n ? n + ' Designs geladen' : 'Keine Designs auf dem Server', 4000)).catch((er) => toast('Server: ' + errMsg(er), 6000)); }
    if (d === 'ddel' && confirm('Design „' + t.dataset.n + '“ löschen?')) { Design.Store.del(t.dataset.n).then(() => { if (S.dLand === t.dataset.n) S.dLand = ''; if (S.dSplit === t.dataset.n) S.dSplit = ''; if (S.dPort === t.dataset.n) S.dPort = ''; save(true); cur = null; applyDesign(); loadDesigns(); }); }
    if (d === 'dexp') Design.Store.get(t.dataset.n).then((dd) => { const text = JSON.stringify(dd), name = dd.name + '.tacho.json'; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Gespeichert: ' + name); } catch (er) { navigator.clipboard && navigator.clipboard.writeText(text).then(() => toast('In die Zwischenablage kopiert')); } });
    if (d === 'accopen') { if (!AppCtl) { toast('Nur in der APK'); return; } AppCtl.accessEnabled().then((r) => { if (r.enabled) toast('Bedienungshilfe ist an', 4000); else { AppCtl.openAccessSettings(); toast('Schalte hier „Tacho“ ein. Auf neueren Androiden vorher in den App-Infos „Eingeschränkte Einstellungen zulassen“ wählen.', 9000); } }); }
    if (d === 'appsload') { if (!AppCtl) { toast('Nur in der APK'); return; } appList().then((l) => { const box = $('#applist'); box.innerHTML = l.map((a) => `<button class="approw ${S.splitApp.pkg === a.p ? 'on' : ''}" data-pkg="${Design.esc(a.p)}" data-l="${Design.esc(a.l)}">${Design.esc(a.l)}</button>`).join(''); }).catch((er) => toast(errMsg(er), 5000)); }
    if (d === 'cmdgo') { const v = $('#cmdIn').value; if (v) heard(v); }
    if (d === 'rday') run({ act: 'reset', what: 'day' });
    if (d === 'rtrip') run({ act: 'reset', what: 'trip' });
    if (d === 'rmax') run({ act: 'reset', what: 'max' });
    if (d === 'rall' && confirm('Alle Einstellungen und Zähler löschen?')) { try { localStorage.removeItem('tacho2'); } catch (_) { /* egal */ } location.reload(); }
  });
  $('#panel').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'cmdIn') { const v = e.target.value; if (v) heard(v); } });
  // Die Enter-Taste im Textfeld des Aktivierungsworts soll nicht neu laden
  $('#panel').addEventListener('input', (e) => { if (e.target.dataset.k === 'hero' || e.target.dataset.k === 'tsize') { S[e.target.dataset.k] = +e.target.value; applyLook(); } });

  // ---------- Start ----------
  applyLook(); applyOrient(); applyAwake(); startSats(); render();
  if (S.lp) { R.lat = S.lp.lat; R.lon = S.lp.lon; setTimeout(fetchStuff, 300); }
  if (S.wake) startWake().then((ok) => { if (!ok) { S.wake = false; paintMic(); } });
  if (S.bt && AppCtl) AppCtl.bt({ on: true }).catch(() => {});
  paintMic();
  window.__import = importText; window.__R = R; window.__S = () => S; window.__engine = engine; window.__onPos = onPos;
})();
