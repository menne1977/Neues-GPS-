/* Navi-Oberfläche: Suche, Orte (Zuhause, Arbeit, Favoriten, Parkplatz), Karte mit Zoom und Farben, Ansagen. Nutzt Nav (nav.js). */
(function (root) {
  'use strict';
  const Nav = root.Nav;
  let A = null; // Schnittstelle zur App: R, S, toast, speak, fetch, roads, heading, live, save
  const N = { dest: null, route: null, guide: null, st: null, busy: false, lastRe: 0, open: false, results: [], ropts: null, zoomAuto: true, zoomHalf: 400, pan: { x: 0, y: 0 }, rails: [], railSaid: {}, jamSeen: {}, jamAsk: null, jamT: 0, prev: null, voices: null, panT: 0, view: null, fx: null, off: null, offRoads: null };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eta = (s) => { const d = new Date(Date.now() + s * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const hhmm = () => eta(0);
  const meters = (m) => Nav.fmtDist(m).replace(' km', ' Kilometer').replace(' m', ' Meter');

  // ---------- Orte ----------
  const P = () => { const S = A.S; if (!S.places) S.places = { home: null, work: null, park: null, favs: [] }; if (!S.places.favs) S.places.favs = []; return S.places; };
  const persist = () => { if (A.save) A.save(true); };
  const here = () => (A.R.lat != null ? { lat: A.R.lat, lon: A.R.lon } : (A.S.lp ? { lat: A.S.lp.lat, lon: A.S.lp.lon } : null));
  function setPlace(kind, pl) {
    const p = P();
    if (kind === 'fav') { p.favs = p.favs.filter((f) => f.name !== pl.name).concat({ name: pl.name, lat: pl.lat, lon: pl.lon }).slice(-30); }
    else p[kind] = { name: pl.name, lat: pl.lat, lon: pl.lon, t: pl.t };
    persist(); renderPlaces();
  }
  async function nameHere(pos) {
    try {
      const to = new Promise((_, rej) => setTimeout(() => rej(new Error('zeit')), 4000));
      const r = await Promise.race([A.fetch(`https://photon.komoot.io/reverse?lang=de&lon=${pos.lon}&lat=${pos.lat}`, {}), to]);
      const j = await r.json(); const pr = ((j.features || [])[0] || {}).properties || {};
      const st = pr.street ? pr.street + (pr.housenumber ? ' ' + pr.housenumber : '') : (pr.name || '');
      return [st, pr.city || pr.town || pr.village || ''].filter(Boolean).join(', ');
    } catch (e) { return ''; }
  }
  async function saveHere(kind, label) {
    if (kind === 'park' && N.route && N.ropts && N.ropts.veh === 'fuss') { const m = 'Du gehst gerade zu Fuß. Das Auto bleibt gemerkt. Mit 🚗 geht es zurück.'; A.toast(m, 4500); return m; }
    const pos = here(); if (!pos) { A.toast('Noch kein Standort.', 3000); return 'Noch kein Standort.'; }
    let name = label || (await nameHere(pos));
    if (kind === 'park') name = 'Parkplatz ' + hhmm() + (name ? ', ' + name : '');
    else if (!name) name = (kind === 'home' ? 'Zuhause' : kind === 'work' ? 'Arbeit' : 'Favorit ' + (P().favs.length + 1));
    setPlace(kind, { name, lat: pos.lat, lon: pos.lon, t: Date.now() });
    const msg = { home: 'Zuhause gespeichert.', work: 'Arbeit gespeichert.', park: 'Parkplatz gespeichert. Ich führe dich später zurück.', fav: 'Favorit gespeichert.' }[kind];
    A.toast(msg, 4000); speak(msg); return msg;
  }
  // Name aus der Sprache zu einem gespeicherten Ort
  function resolve(q) {
    q = String(q || '').toLowerCase().trim(); const p = P();
    if (/^(hause|haus|zuhause|zu hause|meinem haus|meiner wohnung|wohnung)$/.test(q)) return p.home ? { place: p.home } : { missing: 'Zuhause ist noch nicht gespeichert. Sage „Speichere diesen Ort als Zuhause“.' };
    if (/^(arbeit|der arbeit|meiner arbeit|büro|dem büro|arbeitsplatz)$/.test(q)) return p.work ? { place: p.work } : { missing: 'Arbeit ist noch nicht gespeichert. Sage „Speichere diesen Ort als Arbeit“.' };
    if (/(^|\b)(auto|parkplatz|geparkt|fahrzeug)\b/.test(q)) return p.park ? { place: p.park, ov: { veh: 'fuss' } } : { missing: 'Ich habe noch keinen Parkplatz. Sage „Hier geparkt“.' };
    const f = p.favs.find((x) => { const n = x.name.toLowerCase(); return n === q || n.includes(q) || (q.length > 3 && q.includes(n.split(',')[0])); });
    return f ? { place: f } : null;
  }

  // ---------- Karte: Farben ----------
  const THEMES = {
    nacht: { n: 'Nacht', bg: '#0a1220', road: '#3a4252', route: '#2f8bff', core: '#7cc0ff', done: '#55607a', car: '#16d17a', pin: '#ff3b30' },
    tag: { n: 'Tag', bg: '#eef2f6', road: '#b6c0cd', route: '#1a6bff', core: '#8fb8ff', done: '#a0aab8', car: '#0a9d5a', pin: '#e02b20' },
    kontrast: { n: 'Kontrast', bg: '#000000', road: '#707070', route: '#ffd400', core: '#fff3a0', done: '#555555', car: '#00ff88', pin: '#ff4d4d' },
    natur: { n: 'Natur', bg: '#0d1f14', road: '#3f5f48', route: '#ffb703', core: '#ffe29a', done: '#4c6a52', car: '#9cff4d', pin: '#ff6b5a' },
    grau: { n: 'Grau', bg: '#1c1c1c', road: '#4d4d4d', route: '#e6e6e6', core: '#ffffff', done: '#6e6e6e', car: '#16d17a', pin: '#ff5a4d' }
  };
  const theme = () => THEMES[A.S.navMap] || THEMES.nacht;
  function setTheme(k) { if (THEMES[k]) { A.S.navMap = k; persist(); renderOpts(); draw(); } }

  // ---------- Anzeige: Pfeil-Stil, Farbe, Größe, Hintergrund, Ansage, Platz im Tacho ----------
  const LOOK = {
    style: [['klassisch', 'Klassisch'], ['schlank', 'Schlank'], ['kontur', 'Umriss'], ['zeichen', 'Zeichen']],
    col: [['blau', 'Blau'], ['weiss', 'Weiß'], ['gelb', 'Gelb'], ['gruen', 'Grün'], ['orange', 'Orange']],
    size: [['normal', 'Normal'], ['gross', 'Groß'], ['riesig', 'Sehr groß']],
    bg: [['dunkel', 'Dunkelblau'], ['schwarz', 'Schwarz'], ['hell', 'Hell']],
    ann: [['250', '250 m'], ['500', '500 m'], ['750', '750 m'], ['1000', '1 km'], ['auto', 'Nach Tempo']],
    dock: [['oben', 'Leiste oben im Tacho'], ['unten', 'Leiste unten im Tacho'], ['fenster', 'Schwebendes Fenster'], ['design', 'Nur im eigenen Tacho-Design'], ['aus', 'Aus']],
    then: [['an', 'Danach zeigen'], ['aus', 'Danach ausblenden']]
  };
  const LOOKL = { style: 'Pfeil-Stil', col: 'Pfeil-Farbe', size: 'Schrift und Pfeil', bg: 'Hintergrund', ann: 'Erste Ansage vor dem Abbiegen', dock: 'Navi im Tacho', then: 'Nächste Abbiegung' };
  const COL = { blau: '#7cc0ff', weiss: '#ffffff', gelb: '#ffd400', gruen: '#3ef08a', orange: '#ff9f1a' };
  const SIZE = { normal: 1, gross: 1.3, riesig: 1.65 };
  const BG = { dunkel: ['#0b1626f0', '#ffffff', '#0b1626'], schwarz: ['#000000', '#ffffff', '#000000'], hell: ['#f2f5f8f5', '#0b1626', '#f2f5f8'] };
  const look = () => Object.assign({ style: 'klassisch', col: 'blau', size: 'normal', bg: 'dunkel', ann: '500', dock: 'oben', then: 'an' }, A.S.navLook || {});
  function setLook(patch) { A.S.navLook = Object.assign(look(), patch); persist(); applyLook(); renderOpts(); if (N.st) paint(N.st); return 'Eingestellt.'; }
  const arrowCol = (l) => { const c = COL[l.col] || COL.blau; return l.bg === 'hell' && (l.col === 'weiss' || l.col === 'gelb') ? '#1a5fd6' : c; };
  const iconOf = (st, small) => { const l = look(); return Nav.icon(st, { style: l.style, col: arrowCol(l), bg: BG[l.bg][2] }); };
  function applyLook() {
    const l = look(), r = document.documentElement.style;
    r.setProperty('--nv-scale', SIZE[l.size] || 1); r.setProperty('--nv-bg', BG[l.bg][0]); r.setProperty('--nv-txt', BG[l.bg][1]); r.setProperty('--nv-col', arrowCol(l));
    document.body.classList.toggle('nv-nothen', l.then === 'aus');
    document.body.classList.toggle('nv-big', l.size !== 'normal');
    dock();
  }
  // Platz des kleinen Navi-Fensters: als Leiste im Tacho, schwebend, nur im Design oder aus
  let lastH = -1;
  function dock() {
    const mini = $('navmini'), app = document.getElementById('app'); if (!mini) return;
    const l = look(), b = document.body, hasEl = !!(A.hasNaviEl && A.hasNaviEl());
    let mode = l.dock; if (mode === 'design' && !hasEl) mode = 'oben';
    const on = !!N.route && !N.open && mode !== 'aus' && !hasEl;
    mini.hidden = !on;
    const docked = on && (mode === 'oben' || mode === 'unten');
    if (docked && app) { if (mode === 'oben') { const h = document.getElementById('hero'); if (mini.nextSibling !== h) app.insertBefore(mini, h); } else if (mini.parentNode !== app || mini.nextSibling) app.appendChild(mini); }
    else if (mini.parentNode !== document.body) document.body.appendChild(mini);
    b.classList.toggle('nv-dock', docked); b.classList.toggle('nv-top', docked && mode === 'oben'); b.classList.toggle('nv-bot', docked && mode === 'unten');
    const h = docked ? mini.offsetHeight : 0;
    if (h !== lastH) { lastH = h; document.documentElement.style.setProperty('--nvh', h + 'px'); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); }
  }

  // ---------- Auswahl (Fahrzeug, Kurven, Strecke, Landschaft) ----------
  const OPT = {
    veh: [['auto', 'Auto'], ['motorrad', 'Motorrad'], ['fuss', 'Zu Fuß']],
    curves: [['egal', 'Kurven egal'], ['wenig', 'Wenig Kurven'], ['mittel', 'Mittlere Kurven'], ['viele', 'Viele Kurven']],
    type: [['normal', 'Ausgewogen'], ['schnell', 'Schnellste'], ['kurz', 'Kürzeste'], ['sparsam', 'Sparsam'], ['lang', 'Längste'], ['gemuetlich', 'Gemütlich']],
    scenic: [['wald', 'Wald'], ['felder', 'Felder und Wiesen'], ['wasser', 'Wasser'], ['heide', 'Heide']],
    avoid: [['autobahn', 'Autobahn'], ['maut', 'Mautstraßen'], ['faehre', 'Fähren'], ['stadt', 'Innenstadt umfahren']]
  };
  const LBL = { veh: 'Fahrzeug', curves: 'Kurven (Motorrad)', type: 'Streckenart', scenic: 'Landschaft, bei mir mit Aussicht', avoid: 'Vermeiden' };
  const opts = () => Object.assign({ veh: 'auto', curves: 'egal', type: 'normal', scenic: [], avoid: [] }, A.S.navOpt || {});
  function setOpt(patch) { A.S.navOpt = Object.assign(opts(), patch); renderOpts(); persist(); }
  const XO = {
    rail: [['unsicher', 'Ohne Schranke und unbekannte'], ['offen', 'Nur ohne Schranke'], ['alle', 'Alle Bahnübergänge'], ['aus', 'Aus']],
    jam: [['frage', 'Bei Stau fragen'], ['auto', 'Stau automatisch umfahren'], ['aus', 'Staus nicht prüfen']],
    prev: [['an', 'Routenvorschau mit Alternativen'], ['aus', 'Sofort losfahren']],
    prevAuto: [['an', 'Vorschau startet nach 12 s von selbst'], ['aus', 'Nur mit „Los“']],
    off: [['an', 'Strecke automatisch offline sichern'], ['aus', 'Nicht sichern']],
    snap: [['an', 'Position auf die Straße einrasten'], ['aus', 'Rohes GPS zeigen']]
  };
  const XL = { rail: 'Warnung vor Bahnübergängen', jam: 'Staus auf der Route (Autobahn)', prev: 'Vor dem Start', prevAuto: 'Vorschau', off: 'Funkloch-Schutz', snap: 'GPS-Anzeige' };
  const X = () => Object.assign({ rail: 'unsicher', jam: 'frage', prev: 'an', prevAuto: 'an', off: 'an', snap: 'an' }, A.S.navX || {});
  function setX(patch) { A.S.navX = Object.assign(X(), patch); persist(); renderOpts(); return 'Eingestellt.'; }
  function setSpeech(patch) { A.S.navSpeech = Object.assign(speech(), patch); persist(); renderOpts(); return 'Eingestellt.'; }
  const fold = () => Object.assign({ route: false, look: false, map: false, voice: false, extra: false, here: false }, A.S.navFold || {});
  function optSummary(o) {
    const t = [OPT.veh.find((x) => x[0] === o.veh)[1]];
    if (o.veh === 'motorrad' && o.curves !== 'egal') t.push(OPT.curves.find((x) => x[0] === o.curves)[1]);
    if (o.veh !== 'fuss') { t.push(OPT.type.find((x) => x[0] === o.type)[1]); (o.scenic || []).forEach((v) => t.push(OPT.scenic.find((x) => x[0] === v)[1])); (o.avoid || []).forEach((v) => t.push('ohne ' + OPT.avoid.find((x) => x[0] === v)[1].replace(' umfahren', ''))); }
    return t.join(' · ');
  }
  function optsHTML() {
    const o = opts(), l = look(), fd = fold();
    const chips = (k, list, on, attr) => `<div class="nsG"><small>${(attr === 'k' ? LBL : LOOKL)[k]}</small><div class="nsC">${list.map(([v, t]) => `<button class="nsChip${on(v) ? ' on' : ''}" data-${attr}="${k}" data-v="${v}">${k === 'style' ? `<i class="nvchip">${Nav.icon({ kind: 'right' }, { style: v, col: arrowCol(l), bg: BG[l.bg][2] })}</i>` : ''}${t}</button>`).join('')}</div></div>`;
    const route = Object.keys(OPT).filter((k) => o.veh === 'fuss' ? k === 'veh' : !(k === 'curves' && o.veh !== 'motorrad'))
      .map((k) => chips(k, OPT[k], (v) => ((k === 'scenic' || k === 'avoid') ? (o[k] || []).includes(v) : o[k] === v), 'k')).join('');
    const lk = Object.keys(LOOK).map((k) => chips(k, LOOK[k], (v) => String(l[k]) === v, 'l')).join('')
      + `<div class="nvprev">${bannerHTML({ kind: 'roundabout', exit: 2, exitAng: 90, dNext: 350, street: 'Hauptstraße', then: { kind: 'left', d: 900 } })}</div>`;
    const map = `<div class="nsC">${Object.keys(THEMES).map((k) => `<button class="nsChip${(A.S.navMap || 'nacht') === k ? ' on' : ''}" data-theme="${k}">${THEMES[k].n}</button>`).join('')}</div>`;
    const sec = (id, title, sub, body) => `<details class="nsFold" data-fold="${id}"${fd[id] ? ' open' : ''}><summary><b>${title}</b><small>${sub}</small></summary>${body}</details>`;
    return sec('route', 'Route', esc(optSummary(o)), route)
      + sec('look', 'Anzeige und Ansage', esc([LOOK.style.find((x) => x[0] === l.style)[1], LOOK.size.find((x) => x[0] === l.size)[1], 'Ansage ' + LOOK.ann.find((x) => x[0] === String(l.ann))[1], LOOK.dock.find((x) => x[0] === l.dock)[1]].join(' · ')), lk)
      + sec('voice', 'Stimme', esc((MODES[speech().mode] || MODES.normal).n + ' · ' + ((N.voices || []).find((v) => v.name === speech().voice) || { label: 'Standard-Stimme' }).label), voiceHTML())
      + sec('extra', 'Warnungen und Extras', esc([XO.rail.find((x) => x[0] === X().rail)[1], XO.jam.find((x) => x[0] === X().jam)[1]].join(' · ')), Object.keys(XO).map((k) => `<div class="nsG"><small>${XL[k]}</small><div class="nsC">${XO[k].map(([v, t]) => `<button class="nsChip${X()[k] === v ? ' on' : ''}" data-x="${k}" data-v="${v}">${t}</button>`).join('')}</div></div>`).join(''))
      + sec('map', 'Kartenfarbe', esc(theme().n), map)
      + (N.route ? '<button class="act pri" data-reroute="1">Route mit diesen Einstellungen neu berechnen</button>' : '');
  }
  function voiceHTML() {
    loadVoices(); const sp = speech();
    const modes = `<div class="nsG"><small>Sprechart</small><div class="nsC">${Object.keys(MODES).map((k) => `<button class="nsChip${sp.mode === k ? ' on' : ''}" data-sm="${k}">${MODES[k].n}</button>`).join('')}</div></div>`;
    const vs = N.voices == null || (!N.voices.length && A.voices) ? '<div class="nsMsg">Stimmen werden geladen …</div>' : `<div class="nsC">${[{ name: '', label: 'Standard-Stimme' }].concat(N.voices).map((v) => `<button class="nsChip${sp.voice === v.name ? ' on' : ''}" data-sv="${esc(v.name)}">${esc(v.label)}</button>`).join('')}</div>`;
    return modes + `<div class="nsG"><small>Stimme (vom Handy: Mann/Frau, „online“ klingt am echtesten)</small>${vs}</div><button class="act" data-vtest="1">▶ Probe hören</button><div class="nsMsg">Weitere Stimmen: Android-Einstellungen → Sprachausgabe → Sprachdaten installieren.</div>`;
  }
  function renderOpts() { const h = optsHTML(); document.querySelectorAll('.nsOptBox').forEach((el) => { el.innerHTML = h; }); }
  // Banner (Pfeil, Entfernung, Straße, danach) – gemeinsam für Tacho-Leiste, Navi-Kopf und Vorschau
  function bannerHTML(st) {
    const then = st.then ? `<div class="nvN">danach <i class="nvsm">${iconOf(st.then)}</i> in ${Nav.fmtDist(st.then.d)}</div>` : '';
    return `<div class="nvI">${iconOf(st)}</div><div class="nvT"><div class="nvD">${Nav.fmtDist(st.dNext)}</div><div class="nvS">${esc(st.street || st.text || '')}</div>${then}</div>`;
  }
  function onOptClick(e) {
    const xb = e.target.closest('[data-x]'); if (xb) { setX({ [xb.dataset.x]: xb.dataset.v }); return; }
    const sm = e.target.closest('[data-sm]'); if (sm) { setSpeech({ mode: sm.dataset.sm }); speak('So klinge ich jetzt. In 300 Metern rechts abbiegen.'); return; }
    const sv = e.target.closest('[data-sv]'); if (sv) { setSpeech({ voice: sv.dataset.sv }); speak('So klinge ich jetzt. In 300 Metern rechts abbiegen.'); return; }
    if (e.target.closest('[data-vtest]')) { speak('In 500 Metern im Kreisverkehr die zweite Ausfahrt nehmen.'); return; }
    const t = e.target.closest('button[data-theme]'); if (t) { setTheme(t.dataset.theme); return; }
    if (e.target.closest('[data-reroute]')) { N.ropts = opts(); N.lastRe = 0; $('nsSet').hidden = true; reroute(); return; }
    const L = e.target.closest('[data-l]'); if (L) { setLook({ [L.dataset.l]: L.dataset.v }); return; }
    const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k, v = b.dataset.v, o = opts();
    if (k === 'scenic' || k === 'avoid') setOpt({ [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : o[k].concat(v) }); else setOpt({ [k]: v });
  }
  function onFold(e) { const d = e.target; if (!d.matches || !d.matches('details.nsFold')) return; const f = fold(); f[d.dataset.fold] = d.open; A.S.navFold = f; persist(); }
  function renderPlaces() {
    offRender();
    const el = $('nsPlaces'); if (!el) return; const p = P();
    const q = (k, ico, lab) => p[k]
      ? `<span class="nsPl"><button class="nsPb" data-go="${k}">${ico} ${lab}</button><button class="nsX" data-clr="${k}" aria-label="${lab} löschen">✕</button></span>`
      : `<span class="nsPl"><button class="nsPb off" data-go="${k}">${ico} ${lab} setzen</button></span>`;
    const tile = (attr, ico, lab, sub, del, off) => `<div class="nsTile${off ? ' off' : ''}"><button class="nsTb" ${attr}><i>${ico}</i><b>${esc(lab)}</b><small>${esc(sub)}</small></button>${del ? `<button class="nsTx" ${del} aria-label="${esc(lab)} löschen">✕</button>` : ''}</div>`;
    const sub = (pl) => (pl ? String(pl.name).split(',').slice(0, 2).join(',') : 'Noch nicht gesetzt');
    const fd = fold();
    el.innerHTML = `<div class="nsSec">Meine Ziele</div><div class="nsTiles">${tile('data-go="home"', '🏠', 'Zuhause', sub(p.home), p.home ? 'data-clr="home"' : '', !p.home)}${tile('data-go="work"', '💼', 'Arbeit', sub(p.work), p.work ? 'data-clr="work"' : '', !p.work)}${p.park ? tile('data-go="park"', '🚗', 'Zum Auto', 'zu Fuß · ' + sub(p.park), 'data-clr="park"') : ''}${p.favs.map((f, i) => tile('data-fav="' + i + '"', '★', String(f.name).split(',')[0], String(f.name).split(',').slice(1, 3).join(','), 'data-delfav="' + i + '"')).join('')}</div>
      <details class="nsFold" data-fold="here"${fd.here ? ' open' : ''}><summary><b>📍 Ort merken</b><small>Zuhause, Arbeit, Parkplatz oder Favorit hier speichern</small></summary><div class="nsC"><button class="nsChip" data-here="home">🏠 Hier ist Zuhause</button><button class="nsChip" data-here="work">💼 Hier ist Arbeit</button><button class="nsChip" data-here="park">🅿 Hier geparkt</button><button class="nsChip" data-here="fav">★ Hier als Favorit</button></div></details>`;
  }

  // ---------- Aufbau ----------
  function build() {
    const mini = document.createElement('div'); mini.id = 'navmini'; mini.hidden = true;
    mini.innerHTML = '<div id="nmBan" class="nvBan"></div><div class="nmR"><b id="nmRem">–</b><small id="nmEta"></small><small id="nmDir"></small></div><button id="nmEnd" aria-label="Navigation beenden">✕<small>Ende</small></button>';
    mini.onclick = () => show();
    mini.querySelector('#nmEnd').onclick = (e) => { e.stopPropagation(); stop(true); };
    document.body.appendChild(mini);
    const scr = document.createElement('div'); scr.id = 'navscreen'; scr.hidden = true;
    scr.innerHTML = `
      <div id="nsTop"><div id="nsBan" class="nvBan"></div><button id="nsClose" aria-label="Zurück zum Tacho">✕</button></div>
      <div id="nsSearch"><div class="nsSL"><div id="nsHead"><button id="nsBack" aria-label="Zurück zum Tacho">←</button><b>Wohin?</b><small id="nsGps"></small></div><div class="nsQRow"><input id="nsQ" type="search" placeholder="Adresse, Ort oder Name" autocomplete="off" autocapitalize="words" enterkeyhint="search"><button id="nsGo" class="act pri" aria-label="Ziel suchen">🔍</button></div><div id="nsRes"></div><div id="nsPlaces"></div><div id="nsOff"></div></div><div class="nsSR"><div class="nsSec">Einstellungen</div><div id="nsOpt" class="nsOptBox"></div></div></div>
      <div id="nsPrev" hidden><div class="npHead"><button id="npBack" aria-label="Zurück">←</button><span><b id="npTitle"></b><small id="npSub"></small></span></div><div class="npMapW"><canvas id="npMap"></canvas></div><div class="npSide"><div id="npList"></div><div class="npBtns"><button id="npCancel" class="act">Abbrechen</button><button id="npGo" class="act pri">Los</button></div></div></div>
      <div id="nsMapW"><canvas id="nsMap"></canvas><div id="nsZoom"><button data-z="in" aria-label="Näher">＋</button><button data-z="out" aria-label="Weiter weg">－</button><button data-z="more" id="nsMore" aria-label="Mehr Knöpfe">☰</button><button data-z="set" aria-label="Einstellungen">⚙</button><div id="nsMoreB"><button data-z="auto" id="nsZa">A</button><button data-z="ori" id="nsOri" aria-label="Kartenausrichtung">🧭</button><button data-z="ctr" id="nsCtr" aria-label="Karte zentrieren">🎯</button><button data-z="off" aria-label="Route offline speichern">💾</button><button data-z="end" id="nsEnd" aria-label="Route beenden">⛔</button><button data-z="col" aria-label="Kartenfarbe">🎨</button><button data-z="car" aria-label="Zurück zum Auto">🚗</button><button data-z="alt" aria-label="Andere Route">🔀</button><button data-z="share" aria-label="Ankunft teilen">📤</button><button data-z="walk" aria-label="Zu Fuß weiter">🚶</button><button data-z="park" aria-label="Hier geparkt">🅿</button></div></div><div id="nsSet" hidden><div class="nsSetH"><b>Einstellungen</b><button id="nsSetX" aria-label="Schließen">✕</button></div><div class="nsOptBox"></div></div></div>
      <div id="nsLive"><div><b id="lvSpeed">0</b><small id="lvUnit">km/h</small></div><div><b id="lvLimit">–</b><small>Limit</small></div><div><b id="lvAlt">–</b><small id="lvAltN">Höhe</small></div><div><b id="lvDir">–</b><small>Richtung</small></div></div>
      <div id="nsBot"><div><b id="nsRem">–</b><small>Rest</small></div><div><b id="nsEta">–</b><small>Ankunft</small></div><div><b id="nsDur">–</b><small>Dauer</small></div><button id="nsTacho" class="act">Tacho</button><button id="nsStop" class="act">Beenden</button></div>`;
    document.body.appendChild(scr);
    const warn = document.createElement('div'); warn.id = 'nvWarn'; warn.hidden = true; warn.onclick = () => { warn.hidden = true; }; document.body.appendChild(warn);
    const ask = document.createElement('div'); ask.id = 'nvAsk'; ask.hidden = true; document.body.appendChild(ask);
    ask.addEventListener('click', (e) => { const b = e.target.closest('[data-jam]'); if (b) { if (b.dataset.jam === 'yes') jamYes(); else jamNo(); } });
    $('npBack').onclick = prevCancel; $('npCancel').onclick = prevCancel; $('npGo').onclick = () => prevGo();
    $('npList').addEventListener('click', (e) => { const b = e.target.closest('[data-alt]'); if (!b || !N.prev) return; N.prev.sel = +b.dataset.alt; N.prev.left = 0; clearInterval(N.prevT); renderPrev(); });
    $('nsClose').onclick = hide; $('nsBack').onclick = hide; $('nsTacho').onclick = hide; $('nsStop').onclick = () => stop(true);
    $('nsGo').onclick = () => search($('nsQ').value);
    $('nsQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') search($('nsQ').value); });
    window.addEventListener('popstate', () => { if (N.open) { N.open = false; $('navscreen').hidden = true; layout(); } });
    $('nsRes').addEventListener('click', (e) => {
      const s = e.target.closest('[data-save]'); const h = e.target.closest('[data-i]');
      if (s) { const r = N.results[+s.dataset.ri]; if (r) { setPlace(s.dataset.save, r); A.toast({ home: 'Als Zuhause gespeichert.', work: 'Als Arbeit gespeichert.', fav: 'Als Favorit gespeichert.' }[s.dataset.save], 3000); } return; }
      if (h) start(N.results[+h.dataset.i]);
    });
    $('nsPlaces').addEventListener('toggle', onFold, true);
    $('nsPlaces').addEventListener('click', (e) => {
      const p = P(), b = e.target.closest('button'); if (!b) return;
      if (b.dataset.go) { const k = b.dataset.go; if (p[k]) start(p[k], k === 'park' ? { veh: 'fuss' } : null); else A.toast('Suche eine Adresse und tippe dort auf ' + (k === 'home' ? '🏠' : '💼') + ', oder nutze „Hier ist …“.', 5000); }
      else if (b.dataset.clr) { p[b.dataset.clr] = null; persist(); renderPlaces(); }
      else if (b.dataset.here) saveHere(b.dataset.here);
      else if (b.dataset.fav) start(p.favs[+b.dataset.fav]);
      else if (b.dataset.delfav) { p.favs.splice(+b.dataset.delfav, 1); persist(); renderPlaces(); }
    });
    $('nsOff').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.off) startOffline(b.dataset.off); else if (b.dataset.deloff) oTx('readwrite', (st) => st.delete(b.dataset.deloff)).then(renderPlaces);
    });
    document.querySelectorAll('.nsOptBox').forEach((el) => { el.addEventListener('click', onOptClick); el.addEventListener('toggle', onFold, true); });
    $('nsSetX').onclick = () => { $('nsSet').hidden = true; };
    $('nsZoom').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return; const z = b.dataset.z;
      if (z === 'in') zoom(0.55); else if (z === 'out') zoom(1.8); else if (z === 'auto') { N.zoomAuto = true; draw(); }
      else if (z === 'col') { const ks = Object.keys(THEMES); setTheme(ks[(ks.indexOf(A.S.navMap || 'nacht') + 1) % ks.length]); A.toast('Karte: ' + theme().n, 1500); }
      else if (z === 'more') { A.S.navMore = !A.S.navMore; persist(); moreBtns(); }
      else if (z === 'set') { renderOpts(); $('nsSet').hidden = !$('nsSet').hidden; }
      else if (z === 'ori') setOrient(null); else if (z === 'ctr') recenter(); else if (z === 'off') saveOffline(); else if (z === 'end') stop(true);
      else if (z === 'car') backToCar(); else if (z === 'alt') altRoute(); else if (z === 'share') shareEta();
      else if (z === 'walk') walkOn(); else if (z === 'park') saveHere('park');
    });
    pinch($('nsMap')); moreBtns();
    window.addEventListener('resize', () => { if (N.open) { draw(); if (N.prev) drawOverview(); } });
    renderOpts(); renderPlaces();
  }

  function moreBtns() { const on = !!A.S.navMore; $('nsMoreB').hidden = !on; $('nsMore').classList.toggle('on', on); $('nsMore').textContent = on ? '▴' : '☰'; }
  function zoom(f) { if (N.zoomAuto) N.zoomHalf = lastSpan; N.zoomAuto = false; N.zoomHalf = Math.max(40, Math.min(9000, N.zoomHalf * f)); draw(); }
  function pinch(cv) {
    const pts = new Map(); let d0 = 0, z0 = 0;
    cv.style.touchAction = 'none';
    const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
    cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { d0 = dist(); z0 = N.zoomAuto ? lastSpan : N.zoomHalf; N.zoomAuto = false; } });
    cv.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; const pv = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { N.pan.x += e.clientX - pv.x; N.pan.y += e.clientY - pv.y; N.panT = Date.now(); updCtr(); return; } if (pts.size === 2 && d0 > 10) { N.zoomHalf = Math.max(40, Math.min(9000, z0 * d0 / Math.max(10, dist()))); draw(); } });
    const up = (e) => { pts.delete(e.pointerId); d0 = 0; N.panT = Date.now(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.8 : 1.25); }, { passive: false });
  }

  function layout() {
    const on = !!N.route, pv = !!N.prev && !on;
    $('nsPrev').hidden = !pv; document.getElementById('navscreen').classList.toggle('pv', pv);
    $('nsLive').hidden = !on; $('nsSearch').hidden = on || pv; $('nsMapW').hidden = !on; $('nsBot').hidden = !on; $('nsTop').hidden = !on;
    dock();
  }
  function gpsInfo() { const el = $('nsGps'); if (!el) return; const a = A.R.acc; el.textContent = A.R.lat == null ? 'GPS sucht …' : 'GPS ±' + Math.round(a || 0) + ' m'; el.className = A.R.lat == null || a > 30 ? 'bad' : a > 12 ? 'mid' : 'good'; }
  function show() { gpsInfo(); if (N.route) startLoop(); if (!N.open) { try { history.pushState({ navi: 1 }, ''); } catch (e) { /* egal */ } } N.open = true; $('navscreen').hidden = false; renderPlaces(); renderOpts(); layout(); if (N.route) draw(); else setTimeout(() => $('nsQ').focus(), 50); }
  function hide() { if (N.open && history.state && history.state.navi) { history.back(); return; } N.open = false; $('navscreen').hidden = true; layout(); }

  // ---------- Suche und Start ----------
  async function search(q) {
    q = String(q || '').trim(); if (!q) return [];
    $('nsRes').innerHTML = '<div class="nsMsg">Suche …</div>';
    try {
      const near = here();
      const list = await Nav.geocode(q, near, A.fetch);
      N.results = list;
      $('nsRes').innerHTML = list.length ? list.map((r, i) => `<div class="nsHit"><button class="nsHitB" data-i="${i}"><b>${esc(r.name.split(',')[0])}</b><small>${esc(r.name.split(',').slice(1).join(',').trim())}${near ? ' · ' + Nav.fmtDist(Nav.hav(near.lat, near.lon, r.lat, r.lon)) : ''}</small></button><span class="nsSv"><button data-save="home" data-ri="${i}" aria-label="Als Zuhause">🏠</button><button data-save="work" data-ri="${i}" aria-label="Als Arbeit">💼</button><button data-save="fav" data-ri="${i}" aria-label="Als Favorit">★</button></span></div>`).join('') : '<div class="nsMsg">Nichts gefunden.</div>';
      return list;
    } catch (e) { $('nsRes').innerHTML = '<div class="nsMsg">' + esc((e && e.message) || e) + '</div>'; return []; }
  }

  async function start(dest, ov) {
    if (!dest) return;
    const from0 = here();
    if (!from0) { A.toast('Noch kein Standort. Bitte kurz warten.', 4000); return 'Noch kein Standort.'; }
    if (N.busy) return 'Ich rechne schon.';
    N.busy = true; A.toast('Route wird berechnet …', 8000);
    try {
      const o = Object.assign(opts(), ov || {});
      const from = A.R.lat != null ? { lat: A.R.lat, lon: A.R.lon, heading: A.heading() } : from0;
      const res = await Nav.plan(from, dest, o, A.fetch, (t) => A.toast(t, 8000));
      N.busy = false;
      if (o.veh !== 'fuss' && X().prev !== 'aus' && !(ov && ov.direct) && res.alts && res.alts.length) return preview(dest, res, o);
      return commit(dest, res.rt, res.info, o, false);
    } catch (e) { N.busy = false; const m = (e && e.message) || String(e); A.toast(m, 6000); return m; }
  }
  const sayDur = (s) => Nav.fmtTime(s).replace(' min', ' Minuten').replace(' h', ' Stunden');
  function commit(dest, rt, info0, o, quiet) {
    const info = Object.assign({}, info0 || {}, { curv: rt.curv || (info0 && info0.curv), scenic: rt.scenic || null });
    N.prev = null; clearInterval(N.prevT);
    N.info = info; N.desc = info.walk ? 'ein Fußweg' : Nav.describe({ rt, info });
    N.altK = 0; N.dest = dest; N.route = rt; N.ropts = o; N.guide = new Nav.Guide(rt); N.st = null; N.lastRe = Date.now(); N.zoomAuto = true;
    N.pan = { x: 0, y: 0 }; N.offRoads = null; N.jamSeen = {}; N.jamAsk = null; hideAsk(); layout(); hide(); A.onRoute && A.onRoute(true);
    const msg = (o.veh === 'fuss' ? 'Fußweg zu ' : 'Route nach ') + String(dest.name || 'Ziel').split(',')[0] + ': ' + meters(rt.len) + ', etwa ' + sayDur(rt.dur) + '.' + (N.desc && !info.walk ? ' Die Strecke ist ' + N.desc + '.' : '') + (info.noScenic ? ' Landschaftsdaten waren nicht erreichbar.' : '');
    A.toast(quiet ? 'Los geht’s.' : msg, quiet ? 2500 : 8000); speak((quiet ? '' : msg + ' ') + (rt.steps[0] ? rt.steps[0].say : ''));
    afterRoute(false); tick(); return msg;
  }
  // ---------- Routenvorschau mit Alternativen (wie Sygic/TomTom) ----------
  function preview(dest, res, o) {
    clearInterval(N.prevT);
    N.prev = { dest, res, o, sel: 0, left: X().prevAuto === 'aus' ? 0 : 12 };
    show(); layout(); renderPrev();
    const r0 = res.alts[0], n = res.alts.length;
    const m = 'Route nach ' + String(dest.name || 'Ziel').split(',')[0] + ': ' + meters(r0.len) + ', etwa ' + sayDur(r0.dur) + '.' + (n > 1 ? ' Es gibt ' + (n - 1) + (n === 2 ? ' Alternative.' : ' Alternativen.') : '') + (N.prev.left ? ' Start in ' + N.prev.left + ' Sekunden.' : ' Tippe auf Los.');
    speak(m);
    if (N.prev.left) N.prevT = setInterval(() => { if (!N.prev) { clearInterval(N.prevT); return; } N.prev.left--; if (N.prev.left <= 0) prevGo(); else { const b = $('npGo'); if (b) b.textContent = 'Los (' + N.prev.left + ')'; } }, 1000);
    return m;
  }
  function prevGo(i) {
    const p = N.prev; if (!p) return 'Keine Vorschau offen.';
    if (i != null && p.res.alts[i - 1]) p.sel = i - 1;
    clearInterval(N.prevT); const rt = p.res.alts[p.sel];
    return commit(p.dest, rt, p.res.info, p.o, true);
  }
  function prevCancel() { clearInterval(N.prevT); N.prev = null; layout(); return 'Vorschau abgebrochen.'; }
  function renderPrev() {
    const p = N.prev; if (!p) return; const alts = p.res.alts, minD = Math.min(...alts.map((a) => a.dur));
    $('npTitle').textContent = String(p.dest.name || 'Ziel').split(',')[0];
    $('npSub').textContent = optSummary(p.o);
    $('npList').innerHTML = alts.map((a, i) => {
      const f = a.flags || {}, tags = [];
      if (a.dur === minD) tags.push('<em class="fast">Schnellste</em>'); if (i === 0) tags.push('<em>Empfohlen</em>');
      if (f.highway) tags.push('<em>Autobahn</em>'); if (f.toll) tags.push('<em class="warn">Maut</em>'); if (f.ferry) tags.push('<em class="warn">Fähre</em>');
      const cw = Nav.describe({ rt: a, info: { curv: a.curv } }); if (cw) tags.push('<em>' + esc(cw.split(',')[0]) + '</em>');
      const dd = Math.round((a.dur - minD) / 60);
      return `<button class="npCard${i === p.sel ? ' on' : ''}" data-alt="${i}" style="--ac:${ALTC[i]}"><span class="npT"><b>${Nav.fmtTime(a.dur)}</b>${dd > 0 ? `<small>+${dd} min</small>` : ''}</span><span class="npM">${Nav.fmtDist(a.len)} · an ${eta(a.dur)}</span><span class="npTags">${tags.join('')}</span></button>`;
    }).join('');
    $('npGo').textContent = p.left ? 'Los (' + p.left + ')' : 'Los';
    drawOverview();
  }
  const ALTC = ['#2f8bff', '#a855f7', '#f59e0b'];
  function drawOverview() {
    const p = N.prev, cv = $('npMap'); if (!p || !cv) return;
    const th = theme(), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(50, r.width), H = Math.max(50, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    let a = 90, b = -90, c = 180, d = -180; p.res.alts.forEach((rt) => rt.shape.forEach((q) => { a = Math.min(a, q.lat); b = Math.max(b, q.lat); c = Math.min(c, q.lon); d = Math.max(d, q.lon); }));
    const k = Math.cos((a + b) / 2 * Math.PI / 180), mx = (c + d) / 2, my = (a + b) / 2;
    const sc = Math.min((W - 40) / Math.max(1e-6, (d - c) * k), (H - 40) / Math.max(1e-6, b - a));
    const P2 = (la, lo) => [W / 2 + (lo - mx) * k * sc, H / 2 - (la - my) * sc];
    g.lineCap = 'round'; g.lineJoin = 'round';
    const order = p.res.alts.map((_, i) => i).filter((i) => i !== p.sel).concat(p.sel);
    order.forEach((i) => { const rt = p.res.alts[i], on = i === p.sel; g.strokeStyle = on ? '#ffffff' : '#00000088'; g.lineWidth = on ? 10 : 8; g.beginPath(); rt.shape.forEach((q, j) => { const [x, y] = P2(q.lat, q.lon); if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.strokeStyle = on ? ALTC[i] : ALTC[i] + '88'; g.lineWidth = on ? 6 : 5; g.stroke(); });
    const s0 = p.res.alts[0].shape[0], e0 = p.res.alts[0].shape[p.res.alts[0].shape.length - 1];
    let [x, y] = P2(s0.lat, s0.lon); g.fillStyle = th.car; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    [x, y] = P2(e0.lat, e0.lon); g.fillStyle = th.pin; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚑', x, y + 1);
  }

  // ---------- Nach dem Routenstart: Bahnübergänge, Offline-Kopie ----------
  function afterRoute(keepRoads) {
    const rt = N.route; N.rails = []; N.railSaid = {}; if (!rt) return;
    if (X().rail !== 'aus' && A.S.online !== false) Nav.rails(rt, A.fetch).then((l) => {
      if (N.route !== rt) return; N.rails = l; const n = l.filter((r) => r.kind === 'offen').length;
      if (n) A.toast(n === 1 ? 'Auf der Route: 1 Bahnübergang ohne Schranke' : 'Auf der Route: ' + n + ' Bahnübergänge ohne Schranke', 5000);
    }).catch(() => { /* egal */ });
    if (X().off !== 'aus' && (!keepRoads || !N.offRoads)) autoCache(rt);
  }
  // ---------- Warnungen: Bahnübergänge ----------
  const RAILN = { offen: 'Bahnübergang ohne Schranke', gesichert: 'beschrankter Bahnübergang', unbekannt: 'Bahnübergang' };
  function railCheck(s) {
    const mode = X().rail; if (mode === 'aus' || !N.rails.length || s.off) return;
    for (const r of N.rails) {
      const d = r.at - s.along; if (d < -10 || d > 1600) continue;
      if (mode === 'offen' && r.kind !== 'offen') continue; if (mode === 'unsicher' && r.kind === 'gesichert') continue;
      const far = Math.max(300, Math.min(800, (A.R.speed || 0) * 15)), nm = RAILN[r.kind];
      if (d <= far + 30 && d > 130 && !N.railSaid[r.id + 'f']) { N.railSaid[r.id + 'f'] = 1; speak('Achtung, ' + nm + ' in ' + Nav.distSay(Math.round(d / 50) * 50) + '.'); warnShow('🚂', nm.charAt(0).toUpperCase() + nm.slice(1), d); }
      if (d <= 130 && d > 0 && !N.railSaid[r.id + 'n']) { N.railSaid[r.id + 'n'] = 1; N.railSaid[r.id + 'f'] = 1; if (r.kind !== 'gesichert') speak('Achtung, Bahnübergang!'); warnShow('🚂', nm.charAt(0).toUpperCase() + nm.slice(1), d); }
    }
  }
  let warnT = 0;
  function warnShow(ico, txt, d) {
    const w = $('nvWarn'); if (!w) return; w.innerHTML = `<i>${ico}</i><span><b>${esc(txt)}</b><small>in ${Nav.fmtDist(d)}</small></span>`; w.hidden = false;
    clearTimeout(warnT); warnT = setTimeout(() => { w.hidden = true; }, 9000);
  }
  // ---------- Stau auf der Route: fragen und umfahren ----------
  function jamCheck(s) {
    if (!A.jams || X().jam === 'aus' || N.jamAsk || N.busy || s.off || Date.now() - N.jamT < 30000) return; N.jamT = Date.now();
    let list = []; try { list = A.jams() || []; } catch (e) { return; }
    const from = Math.max(0, (N.guide ? N.guide.idx : 0) - 2);
    for (const j of list) {
      if (j.la == null) continue; const key = (j.road || '') + (j.title || '') + j.la.toFixed(3) + j.lo.toFixed(3); if (N.jamSeen[key]) continue;
      const pr = Nav.proj(N.route, j.la, j.lo, from); if (pr.d > 250 || pr.at < s.along + 400) continue;
      N.jamSeen[key] = 1; N.jamAsk = { j, d: pr.at - s.along };
      if (X().jam === 'auto') { jamYes(); return; }
      askJam(); return;
    }
  }
  const jamWord = (j) => (j.blocked ? 'Sperrung' : 'Stau') + (j.road ? ' auf der ' + String(j.road).replace(/^([AB])\s*(\d)/, '$1 $2') : '');
  function askJam() {
    const a = N.jamAsk, el = $('nvAsk'); if (!a || !el) return;
    el.innerHTML = `<div class="naQ"><i>🚧</i><span><b>${esc(jamWord(a.j))} in ${Nav.fmtDist(a.d)}</b><small>${esc(a.j.title || '')}</small></span></div><div class="naB"><button class="act" data-jam="no">Weiterfahren</button><button class="act pri" data-jam="yes">Umfahren</button></div>`;
    el.hidden = false;
    speak(jamWord(a.j) + ' in ' + meters(a.d) + '. Soll ich umfahren? Sagen Sie ja oder nein.');
    clearTimeout(N.askT); N.askT = setTimeout(() => { if (N.jamAsk === a) jamNo(true); }, 30000);
  }
  function hideAsk() { const el = $('nvAsk'); if (el) el.hidden = true; clearTimeout(N.askT); }
  function jamNo(silent) { if (!N.jamAsk) return 'Es gibt gerade keine Frage.'; N.jamAsk = null; hideAsk(); if (!silent) speak('Ich bleibe auf der Route.'); return 'Ich bleibe auf der Route.'; }
  const ring = (lat, lon, r) => { const o = []; for (let k = 0; k < 16; k++) { const an = k / 16 * 2 * Math.PI; o.push([+(lon + Math.cos(an) * r / (111320 * Math.cos(lat * Math.PI / 180))).toFixed(5), +(lat + Math.sin(an) * r / 111320).toFixed(5)]); } o.push(o[0]); return o; };
  async function jamYes() {
    const a = N.jamAsk; if (!a) return 'Es gibt gerade keine Frage.'; N.jamAsk = null; hideAsk();
    if (!N.dest || N.busy) return 'Gerade nicht möglich.';
    N.busy = true; A.toast('Umfahrung wird gesucht …', 8000);
    try {
      const o = Object.assign({}, N.ropts || opts()); o.polys = (o.polys || []).concat([ring(a.j.la, a.j.lo, 1300)]);
      const res = await Nav.plan({ lat: A.R.lat, lon: A.R.lon, heading: A.heading() }, N.dest, o, A.fetch);
      if (Nav.proj(res.rt, a.j.la, a.j.lo).d < 500) throw new Error('Keine sinnvolle Umfahrung gefunden. Ich bleibe auf der Route.');
      const before = N.st ? N.st.remainT : null;
      N.route = res.rt; N.ropts = o; N.guide = new Nav.Guide(res.rt); N.st = null; N.lastRe = Date.now(); afterRoute(true);
      const dm = before != null ? Math.round((res.rt.dur - before) / 60) : null;
      const m = jamWord(a.j) + ' wird umfahren' + (dm != null ? (dm > 0 ? ', etwa ' + dm + ' Minuten Umweg ohne Stauzeit gerechnet' : ', kaum Umweg') : '') + '.';
      N.busy = false; A.toast(m, 6000); speak(m + ' ' + (res.rt.steps[0] ? res.rt.steps[0].say : '')); tick(); return m;
    } catch (e) { N.busy = false; const m = (e && e.message) || String(e); A.toast(m, 6000); speak(m); return m; }
  }
  // ---------- Stimme ----------
  const MODES = { normal: { n: 'Normal', p: 1, r: 1.02 }, ernst: { n: 'Ernst', p: 0.82, r: 0.93 }, ruhig: { n: 'Ruhig', p: 0.95, r: 0.86 }, lustig: { n: 'Lustig', p: 1.3, r: 1.1 }, schnell: { n: 'Schnell', p: 1, r: 1.28 }, tief: { n: 'Tief', p: 0.65, r: 0.96 }, hoch: { n: 'Hoch', p: 1.5, r: 1.02 } };
  const speech = () => Object.assign({ voice: '', mode: 'normal' }, A.S.navSpeech || {});
  function vLabels(list) {
    const cnt = { Frau: 0, Mann: 0, Stimme: 0 };
    return list.map((v) => {
      const n = String(v.name).toLowerCase();
      const g = /(deg|deh|-m\d|male|mann|männ|hans|markus|stefan|yannick)/.test(n) && !/female/.test(n) ? 'Mann' : /(deb|dea|nfh|def|female|frau|anna|petra|helena|katja|vicki|marlene)/.test(n) ? 'Frau' : 'Stimme';
      cnt[g]++; return { name: v.name, label: g + ' ' + cnt[g] + (v.network ? ' · online, natürlicher' : '') + (v.installed === false ? ' · nicht geladen' : '') };
    });
  }
  function loadVoices() { if (N.voices || !A.voices) return; N.voices = []; A.voices().then((l) => { N.voices = vLabels(l || []); renderOpts(); }).catch(() => { N.voices = []; }); }
  function fun(t, mode) {
    if (mode !== 'lustig' || /Achtung|Stau|Sperrung|Bahn/.test(t)) return t;
    t = t.replace('Sie haben Ihr Ziel erreicht.', 'Tadaa! Ziel erreicht. Gut gefahren, Chef!').replace('Route neu berechnet.', 'Hoppla! Ich hab schnell umgeplant.').replace('Navigation beendet.', 'Feierabend für mich. Tschüssi!');
    if (!/^In /.test(t) && /(links|rechts|Ausfahrt|abbiegen|halten)/i.test(t) && Math.random() < 0.4) t += [' Hopp hopp!', ' Na los!', ' Auf geht’s!', ' Schwungvoll!'][Math.floor(Math.random() * 4)];
    return t;
  }

  async function go(q) {
    const r = resolve(q);
    if (r && r.missing) { A.toast(r.missing, 5000); speak(r.missing); return r.missing; }
    if (r && r.place) return start(r.place, r.ov);
    const list = await search(q);
    if (list && list.length) return start(list[0]);
    show(); return 'Ich finde „' + q + '“ nicht.';
  }

  function stop(say) {
    if (N.prev) return prevCancel();
    N.jamAsk = null; hideAsk();
    const was = !!N.route; N.offRoads = null; N.pan = { x: 0, y: 0 }; N.route = null; N.guide = null; N.st = null; N.dest = null;
    layout(); A.onRoute && A.onRoute(false);
    if (was && say) { speak('Navigation beendet.'); A.toast('Navigation beendet.'); }
    return was ? 'Navigation beendet.' : 'Es läuft keine Navigation.';
  }
  function speak(t) { if (A.S.navVoice === false || !t) return; const sp = speech(), M = MODES[sp.mode] || MODES.normal; A.speak(fun(t, sp.mode), { pitch: M.p, rate: M.r, voice: sp.voice }); }

  // Zu Fuß weiter: gleiches Ziel, jetzt als Fußweg
  async function walkOn() {
    if (!N.dest) { setOpt({ veh: 'fuss' }); const m = 'Zu Fuß eingestellt. Wähle ein Ziel.'; A.toast(m, 3000); return m; }
    if (!(N.ropts && N.ropts.veh === 'fuss')) { const pos = here(); if (pos) { const nm = await nameHere(pos); setPlace('park', { name: 'Auto ' + hhmm() + (nm ? ', ' + nm : ''), lat: pos.lat, lon: pos.lon, t: Date.now() }); A.toast('Auto hier gemerkt. Zurück per 🚗.', 4000); } }
    N.ropts = Object.assign({}, N.ropts || opts(), { veh: 'fuss' }); N.lastRe = 0; N.busy = false;
    A.toast('Fußweg wird berechnet …', 5000);
    try {
      const res = await Nav.plan({ lat: A.R.lat, lon: A.R.lon, heading: null }, N.dest, N.ropts, A.fetch);
      N.route = res.rt; N.guide = new Nav.Guide(res.rt); N.st = null; N.zoomAuto = true;
      const m = 'Zu Fuß weiter, noch ' + meters(res.rt.len) + '.'; speak(m); A.toast(m, 4000); tick(); return m;
    } catch (e) { const m = (e && e.message) || String(e); A.toast(m, 5000); return m; }
  }

  // Zurück zum Auto: jederzeit, auch mitten in einer anderen Route
  async function backToCar() {
    const p = P().park; if (!p) { const m = 'Kein Auto gemerkt. Sage „Hier geparkt“ oder tippe auf 🅿.'; A.toast(m, 4500); return m; }
    if (N.busy) return 'Ich rechne schon.';
    N.route = null; N.guide = null; N.st = null; layout();
    return start(p, { veh: 'fuss' });
  }
  // Andere Route zum selben Ziel (Alternative)
  async function altRoute() {
    if (!N.dest || !N.route) { const m = 'Erst eine Route starten.'; A.toast(m, 3000); return m; }
    if (N.busy) return 'Ich rechne schon.'; N.busy = true; A.toast('Alternative wird gesucht …', 6000);
    try {
      const k = (N.altK || 0) + 1, o = Object.assign({}, N.ropts || opts(), { pick: k });
      const res = await Nav.plan({ lat: A.R.lat, lon: A.R.lon, heading: A.heading() }, N.dest, o, A.fetch);
      if (!(res.info && res.info.pool > 1)) { N.busy = false; const m = 'Es gibt keine andere sinnvolle Route.'; A.toast(m, 3500); speak(m); return m; }
      N.altK = k; N.route = res.rt; N.guide = new Nav.Guide(res.rt); N.st = null; N.lastRe = Date.now(); afterRoute(true);
      const m = 'Route ' + ((res.info.pick || 0) + 1) + ' von ' + res.info.pool + ': ' + meters(res.rt.len) + ', etwa ' + Nav.fmtTime(res.rt.dur).replace(' min', ' Minuten').replace(' h', ' Stunden') + '.';
      N.busy = false; A.toast(m, 5000); speak(m + ' ' + (res.rt.steps[0] ? res.rt.steps[0].say : '')); tick(); return m;
    } catch (e) { N.busy = false; const m = (e && e.message) || String(e); A.toast(m, 5000); return m; }
  }
  // Ankunftszeit und Standort teilen
  async function shareEta() {
    if (!N.st || !N.dest) { const m = 'Keine Navigation aktiv.'; A.toast(m, 3000); return m; }
    const text = 'Ich bin unterwegs nach ' + String(N.dest.name || 'Ziel').split(',')[0] + ', Ankunft etwa ' + eta(N.st.remainT) + ' Uhr (noch ' + Nav.fmtDist(N.st.remain) + '). Standort: https://maps.google.com/?q=' + A.R.lat.toFixed(5) + ',' + A.R.lon.toFixed(5);
    try { if (navigator.share) { await navigator.share({ text }); return 'Geteilt.'; } } catch (e) { return 'Abgebrochen.'; }
    try { await navigator.clipboard.writeText(text); A.toast('Text kopiert. Jetzt in einer Nachricht einfügen.', 5000); return 'Text kopiert.'; } catch (e) { A.toast(text, 9000); return text; }
  }

  async function reroute() {
    if (N.busy || !N.dest || Date.now() - N.lastRe < 12000) return;
    N.busy = true; N.lastRe = Date.now();
    try {
      const res = await Nav.plan({ lat: A.R.lat, lon: A.R.lon, heading: A.heading() }, N.dest, N.ropts || opts(), A.fetch);
      N.route = res.rt; N.guide = new Nav.Guide(res.rt); afterRoute(true); speak('Route neu berechnet.');
    } catch (e) { A.toast('Neu berechnen nicht möglich: ' + ((e && e.message) || e), 4000); }
    N.busy = false;
  }

  function tick() {
    if (!N.guide || A.R.lat == null) return;
    const l0 = look(), s = N.guide.update(A.R.lat, A.R.lon, A.R.acc, { first: l0.ann, speed: A.R.speed || 0 }); N.st = s; if (!s) return;
    if (s.say.length) speak(s.say.join('. '));
    if (s.arrived) { const walked = N.ropts && N.ropts.veh === 'fuss', hasCar = !!P().park; speak('Sie haben Ihr Ziel erreicht.' + (walked && hasCar ? ' Für den Rückweg sagen Sie: Zurück zum Auto.' : '')); A.toast(walked && hasCar ? 'Ziel erreicht. Zurück zum Auto: 🚗 tippen.' : 'Ziel erreicht.', 6000); stop(false); return; }
    if (s.off) reroute();
    paint(s); railCheck(s); jamCheck(s);
    if (N.open) {
      $('nsRem').textContent = Nav.fmtDist(s.remain); $('nsEta').textContent = eta(s.remainT); $('nsDur').textContent = Nav.fmtTime(s.remainT);
      draw();
    }
  }
  let lastKey = '';
  function paint(s) {
    const lv = A.live ? A.live() : null;
    const key = [s.kind, s.exit, s.exitAng, Nav.fmtDist(s.dNext), s.street || s.text, s.then ? s.then.kind + Nav.fmtDist(s.then.d) : '', look().style, look().col, look().bg].join('|');
    if (key !== lastKey) { lastKey = key; const h = bannerHTML(s); $('nmBan').innerHTML = h; $('nsBan').innerHTML = h; }
    $('nmRem').textContent = Nav.fmtDist(s.remain); $('nmEta').textContent = 'an ' + eta(s.remainT); $('nmDir').textContent = lv ? lv.dir : '';
    dock();
  }
  function live() {
    if (!N.open || !A.live) return;
    const v = A.live();
    $('lvSpeed').textContent = v.speed; $('lvUnit').textContent = v.unit; $('lvLimit').textContent = v.limit;
    $('lvAlt').textContent = v.alt; $('lvAltN').textContent = v.altName; $('lvDir').textContent = v.dir;
  }
  function onFix() {
    tick(); if (N.open && !N.route) gpsInfo();
    if (A.R.lat != null) { const sn = X().snap !== 'aus' && N.st && N.st.snap && !N.st.off ? N.st.snap : null; N.fx = { t: performance.now(), lat: sn ? sn.lat : A.R.lat, lon: sn ? sn.lon : A.R.lon, sp: A.R.speed || 0, hd: A.heading() }; }
    live();
  }
  // ---------- Flüssige Ansicht: zwischen den GPS-Punkten weiterrechnen ----------
  const orient = () => (A.S.navOrient === 'north' ? 'north' : 'heading');
  function setOrient(v) {
    A.S.navOrient = v || (orient() === 'north' ? 'heading' : 'north'); persist(); N.view = null; updCtr(); draw();
    const m = orient() === 'north' ? 'Karte: Norden oben.' : 'Karte: Fahrtrichtung oben.'; A.toast(m, 1800); return m;
  }
  function recenter() { N.pan = { x: 0, y: 0 }; updCtr(); draw(); return 'Karte zentriert.'; }
  function updCtr() { const b = $('nsCtr'); if (b) b.classList.toggle('on', Math.abs(N.pan.x) + Math.abs(N.pan.y) > 8); const o = $('nsOri'); if (o) o.textContent = orient() === 'north' ? '⬆N' : '🧭'; }
  let rafOn = false, lastF = 0;
  function frame(ts) {
    if (!(N.open && N.route)) { rafOn = false; return; }
    if (ts - lastF > 33) { lastF = ts; if (N.panT && Date.now() - N.panT > 15000 && (N.pan.x || N.pan.y)) { N.pan = { x: 0, y: 0 }; updCtr(); } draw(); }
    requestAnimationFrame(frame);
  }
  function startLoop() { if (!rafOn) { rafOn = true; requestAnimationFrame(frame); } }
  // geschätzte aktuelle Lage und weich nachgeführte Richtung
  function viewPos() {
    const f = N.fx; if (!f) return { lat: A.R.lat, lon: A.R.lon, hd: A.heading() };
    let lat = f.lat, lon = f.lon;
    const dt = Math.min(1.3, (performance.now() - f.t) / 1000);
    if (f.sp > 1 && f.hd != null) { const d = f.sp * dt, a = f.hd * Math.PI / 180; lat += Math.cos(a) * d / 111320; lon += Math.sin(a) * d / (111320 * Math.cos(f.lat * Math.PI / 180)); }
    const tgt = f.hd == null ? (N.view ? N.view.hd : 0) : f.hd; let h = N.view ? N.view.hd : tgt;
    let df = ((tgt - h + 540) % 360) - 180; h = (h + df * 0.18 + 360) % 360;
    N.view = { lat, lon, hd: h }; return N.view;
  }

  function repeat() {
    if (!N.st) return 'Keine Navigation aktiv.';
    const s = N.st.step; const m = 'In ' + Nav.distSay(N.st.dNext) + ' ' + (s.say.charAt(0).toLowerCase() + s.say.slice(1));
    speak(m); return m;
  }
  function info() {
    if (!N.st) return 'Keine Navigation aktiv.';
    return 'Noch ' + meters(N.st.remain) + ', Ankunft um ' + eta(N.st.remainT) + ' Uhr.';
  }

  // ---------- Offline-Routen (Route + Straßen entlang der Strecke) ----------
  let odb = null;
  const oDb = () => odb || (odb = new Promise((res, rej) => { const r = indexedDB.open('navi-offline', 1); r.onupgradeneeded = () => r.result.createObjectStore('r', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const oTx = (mode, fn) => oDb().then((d) => new Promise((res, rej) => { const t = d.transaction('r', mode), q = fn(t.objectStore('r')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  const oList = () => oTx('readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.t - x.t));
  const unpackRoads = (rs) => (rs || []).map((w) => { const g = []; let la = 0, lo = 0; for (let i = 0; i < w.length; i += 2) { la += w[i]; lo += w[i + 1]; g.push({ lat: la / 1e5, lon: lo / 1e5 }); } return { geom: g }; });
  const packWay = (pts) => { const o = []; let la = 0, lo = 0, pl = null; pts.forEach((p, i) => { if (pl && i < pts.length - 1 && Nav.hav(pl.lat, pl.lon, p.lat, p.lon) < 12) return; const a = Math.round(p.lat * 1e5), b = Math.round(p.lon * 1e5); o.push(a - la, b - lo); la = a; lo = b; pl = p; }); return o; };
  async function roadsAlong(rt, prog) {
    const samples = []; const step = rt.len > 150000 ? 3000 : 1500; let next = 0;
    for (let i = 0; i < rt.shape.length; i++) if (rt.cum[i] >= next) { samples.push(rt.shape[i]); next += step; }
    samples.push(rt.shape[rt.shape.length - 1]);
    const seen = new Set(), ways = []; let fail = 0; const chunks = [];
    for (let i = 0; i < samples.length; i += 25) chunks.push(samples.slice(i, i + 25));
    for (let c = 0; c < chunks.length; c++) {
      if (prog) prog(c + 1, chunks.length);
      const pts = chunks[c].map((p) => p.lat.toFixed(4) + ',' + p.lon.toFixed(4)).join(',');
      try {
        const j = await Nav.overpass('[out:json][timeout:60];way(around:350,' + pts + ')["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];out geom qt;', A.fetch);
        (j.elements || []).forEach((w) => { if (seen.has(w.id) || !w.geometry || w.geometry.length < 2) return; seen.add(w.id); ways.push(packWay(w.geometry)); });
      } catch (e) { fail++; }
    }
    return { ways, fail };
  }
  // Strecke im Hintergrund sichern, damit Karte und Führung ein Funkloch überstehen
  async function autoCache(rt) {
    if (N.caching === rt) return; N.caching = rt;
    try {
      const { ways } = await roadsAlong(rt, null);
      if (N.route !== rt) return;
      N.offRoads = unpackRoads(ways);
      const flat = []; rt.shape.forEach((p) => flat.push(+p.lat.toFixed(6), +p.lon.toFixed(6)));
      await oTx('readwrite', (st) => st.put({ id: 'auto', t: Date.now(), name: 'Letzte Route', dest: N.dest, ropts: N.ropts, len: rt.len, dur: rt.dur, shape: flat, steps: rt.steps, roads: ways, rails: N.rails || [] }));
    } catch (e) { /* egal, nur Vorsorge */ } finally { if (N.caching === rt) N.caching = null; }
  }
  async function saveOffline() {
    const rt = N.route; if (!rt) { A.toast('Erst eine Route starten.', 3000); return 'Keine Route aktiv.'; }
    if (N.saving) return 'Ich lade schon.'; N.saving = true;
    const name = String((N.dest && N.dest.name) || 'Route').split(',')[0];
    try {
      A.toast('Route wird für offline gespeichert …', 6000);
      const { ways, fail } = await roadsAlong(rt, (c, n) => A.toast('Straßen laden ' + c + '/' + n, 4000));
      const flat = []; rt.shape.forEach((p) => flat.push(+p.lat.toFixed(6), +p.lon.toFixed(6)));
      const rec = { id: 'r' + Date.now(), t: Date.now(), name, dest: { name: (N.dest && N.dest.name) || name, lat: N.dest ? N.dest.lat : rt.shape[rt.shape.length - 1].lat, lon: N.dest ? N.dest.lon : rt.shape[rt.shape.length - 1].lon }, ropts: N.ropts || opts(), len: rt.len, dur: rt.dur, shape: flat, steps: rt.steps, roads: ways, rails: N.rails || [], fail };
      await oTx('readwrite', (s) => s.put(rec)); N.offRoads = unpackRoads(ways);
      const m = 'Route „' + name + '“ ist offline gespeichert' + (fail ? ' (Karte teilweise, ' + fail + ' Abschnitte fehlten)' : '') + '.'; A.toast(m, 6000); speak(m); renderPlaces(); N.saving = false; return m;
    } catch (e) { N.saving = false; const m = 'Offline speichern fehlgeschlagen: ' + ((e && e.message) || e); A.toast(m, 6000); return m; }
  }
  async function startOffline(id) {
    const rec = (await oList()).find((r) => r.id === id || r.name.toLowerCase() === String(id).toLowerCase()); if (!rec) return 'Keine Offline-Route gefunden.';
    const shape = []; for (let i = 0; i < rec.shape.length; i += 2) shape.push({ lat: rec.shape[i], lon: rec.shape[i + 1] });
    const rt = Nav.finish(shape, rec.steps, rec.len, rec.dur);
    N.dest = rec.dest; N.route = rt; N.ropts = rec.ropts; N.guide = new Nav.Guide(rt); N.st = null; N.lastRe = Date.now(); N.zoomAuto = true; N.pan = { x: 0, y: 0 };
    N.offRoads = unpackRoads(rec.roads); N.rails = rec.rails || []; N.railSaid = {}; N.desc = ''; layout(); hide(); A.onRoute && A.onRoute(true);
    const m = 'Offline-Route nach ' + rec.name + ', ' + meters(rt.len) + '.'; A.toast(m, 5000); speak(m + ' ' + (rt.steps[0] ? rt.steps[0].say : '')); tick(); return m;
  }
  async function offRender() {
    const el = $('nsOff'); if (!el) return; let l = []; try { l = (await oList()).filter((r) => r.id !== 'auto'); } catch (e) { /* egal */ }
    el.innerHTML = l.length ? '<div class="nsSec">Offline-Routen</div><div class="nsTiles">' + l.map((r) => `<div class="nsTile"><button class="nsTb" data-off="${r.id}"><i>💾</i><b>${esc(r.name)}</b><small>${Nav.fmtDist(r.len)} · ohne Internet</small></button><button class="nsTx" data-deloff="${r.id}" aria-label="löschen">✕</button></div>`).join('') + '</div>' : '';
  }

  // ---------- Karte zeichnen ----------
  let lastSpan = 400;
  function draw() {
    const cv = $('nsMap'); if (!cv || $('nsMapW').hidden || !N.route) return;
    const th = theme();
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(50, r.width), H = Math.max(50, r.height);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    if (A.R.lat == null) return; const vp = viewPos(), lat = vp.lat, lon = vp.lon; if (lat == null) return;
    const walk = N.ropts && N.ropts.veh === 'fuss';
    const north = orient() === 'north', hd = vp.hd, rot = north || hd == null ? 0 : -hd * Math.PI / 180;
    const speed = A.R.speed || 0, span = N.zoomAuto ? (walk ? Math.max(120, Math.min(350, speed * 9)) : Math.max(220, Math.min(900, speed * 9))) : N.zoomHalf;
    lastSpan = span; $('nsZa').classList.toggle('on', N.zoomAuto);
    const sc = Math.min(W, H) / 2 / span * 1.15, cx = W / 2 + N.pan.x, cy = H * (north ? 0.55 : 0.68) + N.pan.y, c = Math.cos(lat * Math.PI / 180);
    const P2 = (la, lo) => { const x = (lo - lon) * 111320 * c, y = (la - lat) * 111320; const rx = x * Math.cos(rot) - y * Math.sin(rot), ry = x * Math.sin(rot) + y * Math.cos(rot); return [cx + rx * sc, cy - ry * sc]; };
    const reach = span * 3.2 / 111320, near = (la, lo) => Math.abs(la - lat) < reach && Math.abs(lo - lon) < reach / c;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = th.road; g.lineWidth = Math.max(1.5, Math.min(5, 3 * (400 / span) ** 0.3));
    const rds = (A.roads() || []).concat(N.offRoads || []);
    for (const rd of rds) {
      if (!rd.geom.some((p) => near(p.lat, p.lon))) continue;
      g.beginPath(); rd.geom.forEach((p, i) => { const [x, y] = P2(p.lat, p.lon); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    }
    const rt = N.route, i0 = Math.max(0, (N.guide ? N.guide.idx : 0) - 1);
    const line = (from, to, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); let st = false; for (let i = from; i < to; i++) { const p = rt.shape[i]; if (!near(p.lat, p.lon) && !st) continue; const [x, y] = P2(p.lat, p.lon); if (!st) { g.moveTo(x, y); st = true; } else g.lineTo(x, y); } g.stroke(); g.setLineDash([]); };
    line(0, i0 + 1, th.done, 6); line(i0, rt.shape.length, th.route, 9, walk ? [1, 14] : null); line(i0, rt.shape.length, th.core, walk ? 4 : 3, walk ? [1, 14] : null);
    const pin = (la, lo, col, txt) => { const [x, y] = P2(la, lo); if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return; g.fillStyle = col; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y + 1); };
    const pl = P(); if (pl.park) pin(pl.park.lat, pl.park.lon, '#2f8bff', 'P'); if (pl.home) pin(pl.home.lat, pl.home.lon, '#16a34a', 'H'); if (pl.work) pin(pl.work.lat, pl.work.lon, '#9333ea', 'A');
    const d = rt.shape[rt.shape.length - 1]; pin(d.lat, d.lon, th.pin, '⚑');
    // Bahnübergänge (Andreaskreuz)
    for (const r0 of N.rails || []) { const [x, y] = P2(r0.lat, r0.lon); if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue; const col = r0.kind === 'gesichert' ? '#9aa4b2' : '#ff3b30';
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 2; [[-13, -3, 26, 6], [-3, -13, 6, 26]].forEach((b) => { g.fillRect(b[0], b[1], b[2], b[3]); g.strokeRect(b[0], b[1], b[2], b[3]); }); g.restore(); }
    // Genauigkeit
    const acc = A.R.acc || 0; if (acc > 6) { g.fillStyle = 'rgba(47,139,255,.16)'; g.strokeStyle = 'rgba(47,139,255,.45)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, Math.min(Math.max(W, H), acc * sc), 0, 7); g.fill(); g.stroke(); }
    // Fahrzeug oder Fußgänger
    g.save(); g.translate(cx, cy); if (north && hd != null) g.rotate(hd * Math.PI / 180); g.fillStyle = th.car; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
    if (walk) { g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, -22); g.lineTo(7, -11); g.lineTo(-7, -11); g.closePath(); g.fill(); g.stroke(); }
    else { g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 13); g.lineTo(0, 7); g.lineTo(-12, 13); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
    // GPS-Plakette
    { const t = 'GPS ±' + Math.round(acc) + ' m', col = acc > 30 ? '#ff4d4f' : acc > 12 ? '#f5b301' : '#22c55e'; g.font = 'bold 13px sans-serif'; const tw = g.measureText(t).width + 24; g.fillStyle = '#000000aa'; g.beginPath(); if (g.roundRect) g.roundRect(10, 10, tw, 26, 13); else g.rect(10, 10, tw, 26); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(22, 23, 4.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, 31, 24); }
    // Maßstab
    const bar = [50, 100, 200, 500, 1000, 2000, 5000].find((m) => m * sc > 60) || 5000; g.fillStyle = th.core; g.fillRect(12, H - 18, bar * sc, 3); g.font = '12px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(bar >= 1000 ? bar / 1000 + ' km' : bar + ' m', 12, H - 24);
  }

  function navState() { const s = N.st; if (!N.route || !s) return null; return { kind: s.kind, exit: s.exit, exitAng: s.exitAng, dNext: s.dNext, street: s.street || s.text || '', then: s.then, remain: s.remain, remainT: s.remainT, look: look() }; }
  function vals() {
    const s = N.st;
    if (!N.route || !s) return { navdist: '–', navturn: '', navstreet: '', navremain: '–', navdur: '–', naveta: '–', navactive: false };
    return { navdist: Nav.fmtDist(s.dNext), navturn: s.arrow, navstreet: s.street || s.text || '', navremain: Nav.fmtDist(s.remain), navdur: Nav.fmtTime(s.remainT), naveta: eta(s.remainT), navactive: true };
  }

  function init(api) { A = api; build(); applyLook(); layout(); }
  root.NavUI = { prevGo, prevCancel, jamYes, jamNo, setX, setSpeech, setLook, look, navState, dock, backToCar, altRoute, shareEta, setOrient, recenter, saveOffline, startOffline, setAvoid: (id, on) => { const o = opts(); const l = on ? (o.avoid.includes(id) ? o.avoid : o.avoid.concat(id)) : o.avoid.filter((x) => x !== id); setOpt({ avoid: l }); return l; }, zoomIn: () => zoom(0.55), zoomOut: () => zoom(1.8), zoomAuto: () => { N.zoomAuto = true; draw(); }, setOpt, opts, setTheme, init, show, hide, go, start, stop, onFix, repeat, info, vals, search, saveHere, walkOn, resolve, places: P, active: () => !!N.route, isOpen: () => N.open };
})(window);
