/* Tacho: Hauptprogramm. Sensoren, Anzeige, Sprachsteuerung, Einstellungen. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const CAP = window.Capacitor && window.Capacitor.Plugins || {};
  const Voice = CAP.Voice, Gnss = CAP.Gnss, AppCtl = CAP.AppCtl;
  const L = window.Limit, Cmd = window.Cmd, OBD = window.OBDC;

  // ---------- Kacheln ----------
  const TILES = [
    ['alt', 'Höhe'], ['dir', 'Richtung'], ['acc', 'Beschleunigung'], ['g', 'G-Kraft'], ['max', 'Höchsttempo'], ['avg', 'Ø Tempo Trip'],
    ['time', 'Fahrzeit Trip'], ['day', 'Tageskilometer'], ['trip', 'Trip'], ['total', 'Gesamt'], ['clock', 'Uhrzeit'], ['gps', 'GPS-Genauigkeit'],
    ['sat', 'Satelliten'], ['wx', 'Wetter'], ['wind', 'Böen'], ['grade', 'Steigung'], ['free', 'Spielraum'],
    ['rpm', 'Drehzahl (OBD)'], ['cool', 'Kühlmittel (OBD)'], ['oil', 'Öltemperatur (OBD)'], ['thr', 'Gaspedal (OBD)'], ['load', 'Motorlast (OBD)'],
    ['volt', 'Bordspannung (OBD)'], ['fuel', 'Tankfüllung (OBD)'], ['l100', 'Verbrauch (OBD)']
  ];
  const TNAME = Object.fromEntries(TILES);
  const DEFTILES = ['alt', 'dir', 'acc', 'max', 'day', 'trip', 'clock', 'wx'];
  const OBD_IDS = ['rpm', 'cool', 'oil', 'thr', 'load', 'volt', 'fuel', 'l100'];

  // ---------- Einstellungen ----------
  const DEF = {
    theme: 'nacht', accent: '#3ddc97', layout: 'auto', colsP: 2, colsL: 2, hero: 1, tsize: 1,
    unit: 'kmh', decimals: false, tol: 3, beep: true, warnSpeak: false, announce: false, preview: true,
    replies: true, vol: 80, wake: false, wakeWord: 'tacho', awake: true, online: true, wxOn: true, satOn: true, bt: false,
    veh: 'auto', tiles: DEFTILES.slice(), obd: { type: 'bt', addr: '', host: '192.168.0.10', port: 35000 },
    day: { d: '', dist: 0, mt: 0, max: 0, altMin: null, altMax: null }, trip: { dist: 0, mt: 0, max: 0 }, total: 0, country: 'DE', countryT: 0, lp: null
  };
  let S = load();
  function load() {
    try {
      const x = JSON.parse(localStorage.getItem('tacho2') || 'null');
      if (x) { const d = JSON.parse(JSON.stringify(DEF)); return Object.assign(d, x, { obd: Object.assign(d.obd, x.obd), day: Object.assign(d.day, x.day), trip: Object.assign(d.trip, x.trip) }); }
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
  function isLand() { return S.layout === 'auto' ? innerWidth > innerHeight : S.layout === 'land'; }
  function applyLook() {
    const b = document.body, st = document.documentElement.style;
    b.classList.toggle('land', isLand()); b.classList.toggle('port', !isLand());
    b.dataset.theme = S.theme;
    st.setProperty('--acc', S.accent); st.setProperty('--hs', S.hero); st.setProperty('--ts', S.tsize);
    st.setProperty('--cols', isLand() ? S.colsL : S.colsP);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(b).getPropertyValue('--bg') || '#070b12';
  }
  async function applyOrient() {
    try {
      if (S.layout === 'auto') screen.orientation.unlock();
      else await screen.orientation.lock(S.layout === 'land' ? 'landscape' : 'portrait');
    } catch (e) { /* nicht überall erlaubt, das Layout folgt trotzdem */ }
  }
  addEventListener('resize', () => { applyLook(); render(); });

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
    R.lat = c.latitude; R.lon = c.longitude; R.fixT = Date.now();
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
    if (c.heading != null && !isNaN(c.heading) && v > 4) { R.heading = c.heading; R.headT = Date.now(); }
    if (c.altitude != null && !isNaN(c.altitude)) {
      R.alt = c.altitude; R.altAcc = c.altitudeAccuracy;
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
    render(); save(); fetchStuff();
  }
  function onErr(e) { R.fixT = 0; setChip('#cGps', 'bad', e && e.code === 1 ? 'GPS: Standort nicht erlaubt' : 'GPS: kein Signal'); }
  if (navigator.geolocation) navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });

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
  const headingNow = () => (R.heading != null && Date.now() - R.headT < 8000) ? R.heading : R.compass;

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
  let wxPos = null, wxT = 0, netBusy = false;
  async function fetchStuff() {
    if (!S.online || R.lat == null) return;
    const now = Date.now();
    if (engine.needFetch(R.lat, R.lon)) {
      const ok = await engine.fetchRoads(R.lat, R.lon, (u, o) => fetch(u, o));
      R.netOk = ok; if (ok) { updateLimit(); render(); } setNet();
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
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${R.lat}&longitude=${R.lon}&current=temperature_2m,weather_code,wind_gusts_10m,precipitation&timezone=auto`);
        const j = await r.json();
        if (j.current) { R.wx = j.current; R.wet = (j.current.precipitation > 0.1) || ((j.current.weather_code >= 51 && j.current.weather_code <= 67) || (j.current.weather_code >= 80 && j.current.weather_code <= 82) || j.current.weather_code >= 95); }
      } catch (e) { wxT = now - 14 * 60000; }
    }
  }
  setInterval(() => { if (R.lat != null) fetchStuff(); }, 5000);

  // ---------- Anzeige ----------
  function setChip(id, cls, text) { const el = $(id); el.className = 'chip ' + cls; el.querySelector('span').textContent = text; }
  function setNet() {
    if (!S.online) setChip('#cNet', 'warn', 'Offline-Modus');
    else if (engine.error) setChip('#cNet', 'bad', 'Limit-Server: ' + engine.error);
    else setChip('#cNet', engine.center ? 'ok' : 'warn', engine.center ? 'Online' : 'Lade Straßen …');
  }
  function setObdChip() {
    const el = $('#cObd'); el.hidden = !OBD.on && !OBD.err && !S.tiles.some((t) => OBD_IDS.includes(t));
    setChip('#cObd', OBD.on ? 'ok' : (OBD.err ? 'bad' : 'warn'), OBD.on ? 'OBD' : (OBD.err ? 'OBD: ' + OBD.err.slice(0, 30) : 'OBD aus'));
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
    if (Math.abs(diff) > 0.02) { heroShown += diff * Math.min(1, dt * 7); if (Math.abs(heroTarget - heroShown) < 0.05) heroShown = heroTarget; }
    const txt = S.decimals ? fmt(heroShown, 1) : String(Math.round(heroShown));
    const el = $('#speed'); if (el.textContent !== txt) el.textContent = txt;
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
    setNet(); setObdChip();
    $('#unit').textContent = uName();

    // Schild und Straße
    signHTML(R.limit, $('#sign'));
    const cap = $('#signcap');
    if (!R.limit) cap.textContent = R.lat == null ? 'warte auf GPS' : (S.online ? 'keine Straße erkannt' : 'offline');
    else if (R.limit.kind === 'advisory') cap.textContent = 'Richtgeschwindigkeit';
    else if (R.limit.kind === 'none') cap.textContent = 'kein Limit';
    else if (R.limit.kind === 'default') cap.textContent = 'geschätzt';
    else cap.textContent = R.limit.note && /zeit/.test(R.limit.src) ? 'zeitabhängig' : 'Schild';
    $('#roadname').textContent = R.road ? (R.road.name || R.road.ref || '') : '';
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
    const o = OBD.vals || {}, ob = (k, d, u) => ({ v: o[k] != null ? fmt(o[k], d) : '–', u, dim: o[k] == null && !OBD.on });
    switch (id) {
      case 'alt': return { v: fmt(R.alt), u: 'm', s: S.day.altMin != null ? `↓ ${fmt(S.day.altMin)}  ↑ ${fmt(S.day.altMax)} m` : '', dim: R.alt == null };
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
      case 'rpm': return ob('rpm', 0, 'U/min');
      case 'cool': return ob('cool', 0, '°C');
      case 'oil': return ob('oil', 0, '°C');
      case 'thr': return ob('thr', 0, '%');
      case 'load': return ob('load', 0, '%');
      case 'volt': return ob('volt', 1, 'V');
      case 'fuel': return ob('fuel', 0, '%');
      case 'l100': return ob('l100', 1, 'l/100');
      default: return { v: '–', u: '' };
    }
  }
  const ARROW = (h) => `<svg class="arrow" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><g transform="rotate(${h || 0} 22 22)"><path d="M22 5 L29 24 L22 20 L15 24 Z" fill="var(--acc)"/><path d="M22 39 L29 24 L22 20 L15 24 Z" fill="currentColor" fill-opacity=".3"/></g></svg>`;
  function renderTiles() {
    const box = $('#tiles');
    if (!S.tiles.length) { box.innerHTML = '<div id="empty">Nur Tempo. Sage „Alle Werte“ oder „Zeige Höhe“, oder öffne ⚙.</div>'; return; }
    let h = '';
    for (const id of S.tiles) {
      const t = tileData(id);
      h += `<div class="tile${t.dim ? ' dim' : ''}${t.arrow != null ? ' rose' : ''}" data-id="${id}"><div class="l">${TNAME[id].replace(' (OBD)', '')}</div><div class="v">${t.arrow != null || id === 'dir' ? ARROW(t.arrow) : ''}${t.v}${t.u ? `<small>${t.u}</small>` : ''}</div><div class="s">${t.s || '&nbsp;'}</div></div>`;
    }
    if (box._h !== h) { box.innerHTML = h; box._h = h; }
  }
  setInterval(() => { if (R.lat != null || S.tiles.includes('clock')) renderTiles(); }, 1000);
  OBD.onChange = () => { setObdChip(); renderTiles(); };

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
      case 'alt': return R.alt == null ? 'Die Höhe ist noch nicht bekannt.' : 'Du bist auf ' + Math.round(R.alt) + ' Metern.';
      case 'clock': { const d = new Date(); return 'Es ist ' + d.getHours() + ' Uhr ' + String(d.getMinutes()).padStart(2, '0') + '.'; }
      case 'dir': { const h = headingNow(); return h == null ? 'Die Richtung ist noch nicht bekannt.' : 'Du fährst Richtung ' + dirLong(h) + '.'; }
      case 'wx': return R.wx ? `Draußen sind es ${Math.round(R.wx.temperature_2m)} Grad, ${WX[R.wx.weather_code] || ''}.` : 'Das Wetter ist noch nicht geladen.';
      case 'day': return 'Heute ' + km(S.day.dist) + ' ' + (S.unit === 'mph' ? 'Meilen' : 'Kilometer') + '.';
      case 'time': return 'Fahrzeit im Trip: ' + hms(S.trip.mt) + ' Stunden.';
      default: return TNAME[what].replace(' (OBD)', '') + ': ' + t.v + ' ' + (t.u || '') + '.';
    }
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SW_TEXT = { beep: 'Warnton', warnSpeak: 'Warnansage', announce: 'Limit-Ansage', replies: 'Sprachantworten', wake: 'Aktivierungswort', awake: 'Bildschirm anlassen', online: 'Online-Modus', preview: 'Limit-Vorschau', decimals: 'Nachkommastelle', wxOn: 'Wetter', satOn: 'Satelliten', bt: 'Bluetooth-Mikrofon' };

  function run(a) {
    let msg = '';
    switch (a.act) {
      case 'help': msg = 'Du kannst zum Beispiel sagen: Wie schnell darf ich fahren? Zeige Höhe. Nur Tempo. Thema Neon. Querformat. Toleranz fünf. Alle Befehle stehen in den Einstellungen.'; openSheet('cmd'); break;
      case 'ask': msg = answer(a.what); break;
      case 'tile': {
        if (a.on && !S.tiles.includes(a.id)) S.tiles.push(a.id);
        if (!a.on) S.tiles = S.tiles.filter((x) => x !== a.id);
        msg = TNAME[a.id].replace(' (OBD)', '') + (a.on ? ' eingeblendet.' : ' ausgeblendet.');
        if (a.on && OBD_IDS.includes(a.id) && !OBD.on) msg += ' Dafür den OBD-Adapter in den Einstellungen verbinden.';
        break;
      }
      case 'only': S.tiles = []; msg = 'Nur Tempo.'; break;
      case 'all': S.tiles = TILES.map((t) => t[0]).filter((id) => !OBD_IDS.includes(id) || OBD.on); msg = 'Alle Werte sind sichtbar.'; break;
      case 'default': S.tiles = DEFTILES.slice(); S.theme = 'nacht'; S.accent = DEF.accent; S.hero = 1; S.tsize = 1; msg = 'Standardansicht.'; break;
      case 'move': { const i = S.tiles.indexOf(a.id); if (i < 0) { msg = 'Die Kachel ist nicht sichtbar.'; break; } const j = clamp(i + a.dir, 0, S.tiles.length - 1); S.tiles.splice(j, 0, S.tiles.splice(i, 1)[0]); msg = 'Verschoben.'; break; }
      case 'layout': S.layout = a.id; applyOrient(); msg = a.id === 'land' ? 'Querformat.' : a.id === 'port' ? 'Hochformat.' : 'Automatisch drehen.'; break;
      case 'cols': if (isLand()) S.colsL = a.n; else S.colsP = a.n; msg = a.n + ' Spalten.'; break;
      case 'size': if (a.what === 'hero') S.hero = clamp(+(S.hero + a.delta).toFixed(2), 0.6, 1.6); else S.tsize = clamp(+(S.tsize + a.delta).toFixed(2), 0.6, 1.8); msg = a.delta > 0 ? 'Größer.' : 'Kleiner.'; break;
      case 'theme': S.theme = a.id; msg = 'Thema ' + a.id + '.'; break;
      case 'accent': S.accent = a.color; msg = 'Akzentfarbe ' + a.name + '.'; break;
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
      case 'obd': if (a.on) { openSheet('obd'); msg = 'OBD: Adapter wählen und verbinden.'; } else { OBD.disconnect(); msg = 'OBD getrennt.'; } break;
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
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  const chk = (k, label, hint) => `<div class="row"><label>${label}${hint ? `<small>${hint}</small>` : ''}</label><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}></div>`;
  const sel = (k, label, opts) => `<div class="row"><label>${label}</label><select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(S[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  let obdDevices = [];
  function buildPanel(open) {
    const keep = $('#panel').scrollTop;
    const openIds = open ? [open] : [...document.querySelectorAll('#panel details[open]')].map((d) => d.id);
    const det = (id, title, body) => `<details id="${id}" ${openIds.includes(id) ? 'open' : ''}><summary>${title}</summary>${body}</details>`;
    const vis = TILES.map(([id, name]) => ({ id, name, on: S.tiles.includes(id) }));
    const order = S.tiles.map((id) => vis.find((v) => v.id === id)).concat(vis.filter((v) => !v.on));
    let h = `<h2>Einstellungen <button class="btn" data-do="close">✕</button></h2>`;
    h += det('look', 'Anzeige', `
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
    h += det('tilesec', 'Werte (Kacheln)', `<div class="info">Häkchen = sichtbar. Pfeile verschieben. Oder per Sprache: „Zeige Höhe“, „Verstecke Trip“.</div>` +
      order.map((v) => `<div class="tl"><label><input type="checkbox" data-tile="${v.id}" ${v.on ? 'checked' : ''}> ${v.name}</label>${v.on ? `<button class="mv" data-mv="${v.id}" data-d="-1">↑</button><button class="mv" data-mv="${v.id}" data-d="1">↓</button>` : ''}</div>`).join(''));
    h += det('lim', 'Tempolimit', `
      ${sel('veh', 'Fahrzeug', Object.entries(L.VEHICLES).map(([k, v]) => [k, v.name]))}
      <div class="row"><label>Toleranz (km/h)<small>bis hierhin nur gelbe Warnung</small></label><input type="number" min="0" max="30" data-k="tol" value="${S.tol}" style="width:80px"></div>
      ${chk('beep', 'Warnton bei zu schnell')}${chk('warnSpeak', 'Warnung zusätzlich ansagen')}${chk('announce', 'Neues Limit ansagen')}${chk('preview', 'Nächstes Limit voraus zeigen')}
      <div class="info">Das Limit kommt aus OpenStreetMap, passend zur Fahrtrichtung und Uhrzeit. Ein gestrichelter Rand mit ~ heißt: kein Schild erfasst, es ist ein Richtwert (50 innerorts, 100 außerorts). Das echte Schild gilt immer.</div>`);
    h += det('voice', 'Sprache', `
      ${chk('wake', 'Aktivierungswort immer bereit', 'Mikrofon-Knopf lange drücken schaltet auch um')}
      <div class="row"><label>Aktivierungswort</label><input type="text" id="wakeWord" value="${S.wakeWord}" style="width:140px"></div>
      ${chk('replies', 'Antworten sprechen')}
      <div class="row"><label>Lautstärke</label><input type="range" min="10" max="100" step="5" value="${S.vol}" data-k="vol"></div>
      ${chk('bt', 'Bluetooth-Headset als Mikrofon')}
      <div class="info">Tippe auf 🎙 und sprich, oder sage das Aktivierungswort. Die Erkennung braucht Internet und das deutsche Sprachpaket der Google-App.</div>`);
    h += det('data', 'Daten und Sensoren', `
      ${chk('online', 'Online gehen', 'Straßen, Limit, Wetter. Aus = nur GPS und Sensoren')}
      ${chk('wxOn', 'Wetter laden')}${chk('satOn', 'GPS-Satelliten lesen')}`);
    h += det('obd', 'OBD2-Adapter (nur Werte lesen)', `
      <div class="info">Adapter vorher in Android koppeln. Es werden nur Echtzeitwerte gelesen, nichts am Auto geändert.</div>
      ${sel('obdType', 'Verbindung', [['bt', 'Bluetooth'], ['wifi', 'WLAN']]).replace('data-k="obdType"', 'data-ok="type"').replace(/ selected/g, (m) => m)}
      <div class="row"><label>Adapter</label><select data-ok="addr">${[['', 'bitte suchen']].concat(obdDevices.map((d) => [d.address, d.name || d.address])).concat(S.obd.addr && !obdDevices.some((d) => d.address === S.obd.addr) ? [[S.obd.addr, S.obd.addr]] : []).map(([v, t]) => `<option value="${v}" ${S.obd.addr === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <button class="act" data-do="obdscan">Adapter suchen</button>
      <button class="act pri" data-do="obdgo">${OBD.on ? 'Trennen' : 'Verbinden'}</button>
      <div class="info">${OBD.on ? 'Verbunden.' : (OBD.err ? 'Fehler: ' + OBD.err : 'Nicht verbunden.')} Danach OBD-Werte unter „Werte“ einblenden.</div>`);
    h += det('cmd', 'Sprachbefehle und Test', `
      <div class="row"><input type="text" id="cmdIn" placeholder="Befehl eintippen, z. B. Thema Neon" style="max-width:none;width:100%"><button class="btn" data-do="cmdgo">▶</button></div>
      <ul class="cmd">${Cmd.HELP.map((x) => `<li>${x}</li>`).join('')}</ul>`);
    h += det('reset', 'Zähler', `
      <button class="act" data-do="rday">Tageskilometer auf null</button><button class="act" data-do="rtrip">Trip auf null</button><button class="act" data-do="rmax">Höchsttempo zurücksetzen</button><button class="act" data-do="rall">Alle Einstellungen zurücksetzen</button>`);
    h += `<div class="info">Quellen: OpenStreetMap-Mitwirkende (ODbL) für Straßen und Limits, Open-Meteo für Wetter.</div>`;
    $('#panel').innerHTML = h;
    // Wert der OBD-Verbindungsart setzen (select mit data-ok)
    const ot = $('#panel select[data-ok=type]'); if (ot) ot.value = S.obd.type;
    $('#panel').scrollTop = keep;
  }

  $('#panel').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.k) {
      const k = t.dataset.k; let v = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number' || ['colsP', 'colsL'].includes(k) ? +t.value : t.value);
      if (t.type === 'checkbox') return run({ act: 'toggle', key: k, on: v });
      S[k] = v;
      if (k === 'layout') applyOrient();
      if (k === 'unit') heroTarget = R.speed * fu();
      if (k === 'veh') { engine.cur = null; updateLimit(); }
    } else if (t.dataset.tile) {
      const id = t.dataset.tile; if (t.checked) { if (!S.tiles.includes(id)) S.tiles.push(id); } else S.tiles = S.tiles.filter((x) => x !== id);
    } else if (t.dataset.ok) { S.obd[t.dataset.ok] = t.value; }
    else if (t.id === 'wakeWord') {
      const w = t.value.toLowerCase().replace(/[^a-zäöüß]/g, ''); if (w.length >= 3) { S.wakeWord = w; if (S.wake && Voice) Voice.setWake({ words: wakeWords() }).catch(() => {}); toast('Aktivierungswort: ' + w); } else toast('Mindestens 3 Buchstaben');
    } else return;
    save(true); applyLook(); render(); buildPanel();
  });
  $('#panel').addEventListener('click', (e) => {
    const t = e.target.closest('[data-do],[data-mv],[data-accent]'); if (!t) return;
    if (t.dataset.accent) { S.accent = t.dataset.accent; save(true); applyLook(); render(); return buildPanel(); }
    if (t.dataset.mv) { const i = S.tiles.indexOf(t.dataset.mv), j = clamp(i + +t.dataset.d, 0, S.tiles.length - 1); S.tiles.splice(j, 0, S.tiles.splice(i, 1)[0]); save(true); render(); return buildPanel(); }
    const d = t.dataset.do;
    if (d === 'close') closeSheet();
    if (d === 'cmdgo') { const v = $('#cmdIn').value; if (v) heard(v); }
    if (d === 'rday') run({ act: 'reset', what: 'day' });
    if (d === 'rtrip') run({ act: 'reset', what: 'trip' });
    if (d === 'rmax') run({ act: 'reset', what: 'max' });
    if (d === 'rall' && confirm('Alle Einstellungen und Zähler löschen?')) { try { localStorage.removeItem('tacho2'); } catch (_) { /* egal */ } location.reload(); }
    if (d === 'obdscan') OBD.devices().then((l) => { obdDevices = l; const g = l.find((x) => /obd|elm|vlink|veepeak|vgate|konnwei/i.test(x.name || '')); if (g && !S.obd.addr) S.obd.addr = g.address; save(true); buildPanel('obd'); toast(l.length ? l.length + ' Geräte gefunden' : 'Keine gekoppelten Geräte'); }).catch((er) => toast('Bluetooth: ' + ((er && er.message) || er), 5000));
    if (d === 'obdgo') { if (OBD.on) { OBD.disconnect(); buildPanel('obd'); } else { toast('Verbinde …', 8000); OBD.connect(S.obd).then(() => { toast('OBD verbunden'); buildPanel('obd'); }).catch((er) => { OBD.err = String((er && er.message) || er); toast(OBD.err, 5000); buildPanel('obd'); }); } }
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
  window.__R = R; window.__S = () => S; window.__engine = engine; window.__onPos = onPos;
})();
