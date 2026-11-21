/* Tempolimit-Engine: OSM-Straßen im Umkreis laden, jede GPS-Position lokal einer Straße zuordnen
   (mit Fahrtrichtung), Limit samt Bedingungen auswerten und das nächste Limit voraus ermitteln.
   Reine Logik ohne Oberfläche, deshalb auch in Node testbar. */
(function (root) {
  'use strict';

  // Richtwerte je Land (innerorts / außerorts / Autobahn). Autobahn: Richtgeschwindigkeit oder Höchstwert.
  const TAB = {
    DE: { urban: 50, rural: 100, motorway: 130, adv: true }, AT: { urban: 50, rural: 100, motorway: 130 },
    CH: { urban: 50, rural: 80, motorway: 120 }, FR: { urban: 50, rural: 80, motorway: 130 },
    IT: { urban: 50, rural: 90, motorway: 130 }, NL: { urban: 50, rural: 80, motorway: 100 },
    PL: { urban: 50, rural: 90, motorway: 140 }, BE: { urban: 50, rural: 70, motorway: 120 },
    LU: { urban: 50, rural: 90, motorway: 130 }, DK: { urban: 50, rural: 80, motorway: 130 },
    CZ: { urban: 50, rural: 90, motorway: 130 }, ES: { urban: 50, rural: 90, motorway: 120 }
  };

  // Höchstwerte nach Fahrzeug außerhalb von Ortschaften (StVO Deutschland)
  const VEHICLES = {
    auto: { name: 'Auto', cap: null, key: null },
    motorrad: { name: 'Motorrad', cap: null, key: 'motorcycle' },
    gespann: { name: 'Auto mit Anhänger', cap: 80, key: null },
    motoranhaenger: { name: 'Motorrad mit Anhänger', cap: 60, key: 'motorcycle' },
    lkw: { name: 'Lkw', cap: 80, key: 'hgv' }
  };

  const CAR = /^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road)$/;

  // ---------- Geometrie ----------
  const RAD = Math.PI / 180;
  function project(lat, lon, lat0, lon0) {
    return [(lon - lon0) * Math.cos(lat0 * RAD) * 111320, (lat - lat0) * 110540];
  }
  function bearing(x1, y1, x2, y2) { return (Math.atan2(x2 - x1, y2 - y1) / RAD + 360) % 360; }
  function angDiff(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function hav(la1, lo1, la2, lo2) {
    const R = 6371000, dLa = (la2 - la1) * RAD, dLo = (lo2 - lo1) * RAD;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const key = (p) => p.lat.toFixed(7) + ',' + p.lon.toFixed(7);

  // ---------- Werte lesen ----------
  // Gibt {v, kind, note} zurück. v=null bedeutet ohne Zahl (none / variabel).
  function parseSpeed(raw, country) {
    if (raw == null) return null;
    let s = String(raw).trim().toLowerCase();
    if (!s) return null;
    const t = TAB[country] || TAB.DE;
    let m = s.match(/^(\d+(?:[.,]\d+)?)\s*(km\/h|kmh|mph)?$/);
    if (m) {
      let v = parseFloat(m[1].replace(',', '.'));
      if (m[2] === 'mph') v = Math.round(v * 1.609344);
      return { v: Math.round(v), kind: 'sign' };
    }
    if (s === 'none') return { v: null, kind: 'none' };
    if (s === 'walk') return { v: 7, kind: 'sign', note: 'Schritttempo' };
    if (s === 'signals' || s === 'variable') return { v: null, kind: 'variable', note: 'Wechselverkehrszeichen' };
    m = s.match(/zone:?(\d+)/);
    if (m) return { v: +m[1], kind: 'zone', note: 'Zone ' + m[1] };
    if (/urban/.test(s)) return { v: t.urban, kind: 'default', note: 'innerorts' };
    if (/rural/.test(s)) return { v: t.rural, kind: 'default', note: 'außerorts' };
    if (/motorway/.test(s)) return { v: t.motorway, kind: t.adv ? 'advisory' : 'default', note: 'Autobahn' };
    m = s.match(/(\d+)/);
    if (m) return { v: +m[1], kind: 'sign' };
    return null;
  }

  const DAYS = { mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0 };
  // "Mo-Fr 07:00-16:00", "06:00-19:00", "Sa,Su 22:00-06:00" -> true/false/null (null = nicht auswertbar)
  function timeCondition(cond, date) {
    let c = cond.trim().replace(/^\(|\)$/g, '').trim().toLowerCase();
    if (!c) return null;
    const dow = date.getDay(), mins = date.getHours() * 60 + date.getMinutes();
    let dayOk = true, hasDay = false, timeOk = true, hasTime = false, rest = c;
    const dm = rest.match(/\b((?:mo|tu|we|th|fr|sa|su)(?:\s*-\s*(?:mo|tu|we|th|fr|sa|su))?(?:\s*,\s*(?:mo|tu|we|th|fr|sa|su)(?:\s*-\s*(?:mo|tu|we|th|fr|sa|su))?)*)\b/);
    if (dm) {
      hasDay = true; dayOk = false;
      dm[1].split(',').forEach((part) => {
        const r = part.trim().split('-').map((x) => DAYS[x.trim()]);
        if (r.length === 1) { if (r[0] === dow) dayOk = true; }
        else {
          let a = r[0], b = r[1];
          for (let d = a, n = 0; n < 8; n++, d = (d + 1) % 7) { if (d === dow) { dayOk = true; break; } if (d === b) break; }
        }
      });
      rest = rest.replace(dm[0], ' ');
    }
    const tms = [...rest.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
    if (tms.length) {
      hasTime = true; timeOk = false;
      tms.forEach((m) => {
        const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
        if (a <= b ? (mins >= a && mins < b) : (mins >= a || mins < b)) timeOk = true;
      });
      rest = rest.replace(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g, ' ');
    }
    rest = rest.replace(/[,\s]+/g, ' ').trim();
    if (rest && !/^(off|ph)?$/.test(rest) && !hasDay && !hasTime) return null;
    if (!hasDay && !hasTime) return null;
    return dayOk && timeOk;
  }

  // "80 @ (Mo-Fr 06:00-18:00); 100 @ wet" -> Liste {v, cond}
  function splitConditional(v) {
    const out = []; let depth = 0, cur = '';
    for (const ch of String(v)) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map((x) => { const i = x.indexOf('@'); return i < 0 ? null : { v: x.slice(0, i).trim(), cond: x.slice(i + 1).trim() }; }).filter(Boolean);
  }

  // ---------- Limit einer Straße ----------
  // opts: {fwd:true|false|null, now:Date, veh:'auto', country:'DE', wet:false}
  function wayLimit(tags, opts) {
    const o = Object.assign({ fwd: null, now: new Date(), veh: 'auto', country: 'DE', wet: false }, opts || {});
    const veh = VEHICLES[o.veh] || VEHICLES.auto;
    const t = TAB[o.country] || TAB.DE;
    const dir = o.fwd == null ? null : (o.fwd ? 'forward' : 'backward');
    let note = '';

    // Reihenfolge: Fahrzeug+Richtung, Fahrzeug, Richtung, allgemein
    const keys = [];
    if (veh.key && dir) keys.push('maxspeed:' + veh.key + ':' + dir);
    if (veh.key) keys.push('maxspeed:' + veh.key);
    if (dir) keys.push('maxspeed:' + dir);
    keys.push('maxspeed');

    // 1. Bedingte Limits (Zeit, Nässe)
    const condKeys = keys.map((k) => k + ':conditional');
    for (const ck of condKeys) {
      if (!tags[ck]) continue;
      for (const c of splitConditional(tags[ck])) {
        const cl = c.cond.toLowerCase();
        let hit = null;
        if (/\bwet\b/.test(cl)) { if (o.wet) hit = true; else note = 'bei Nässe ' + c.v; }
        else if (/\b(snow|ice|winter)\b/.test(cl)) { note = (note ? note + ', ' : '') + 'Winter/Schnee ' + c.v; }
        else if (/weight|hgv|trailer|motorcycle|caravan/.test(cl)) { /* Fahrzeugklasse: ignorieren */ }
        else hit = timeCondition(c.cond, o.now);
        if (hit) {
          const p = parseSpeed(c.v, o.country);
          if (p && p.v != null) return finish(p.v, 'sign', 'zeitabhängig', note);
        }
      }
    }
    // 2. Feste Limits
    for (const k of keys) {
      if (tags[k] == null) continue;
      const p = parseSpeed(tags[k], o.country);
      if (!p) continue;
      if (p.kind === 'none') return finish(null, 'none', 'frei', note, veh, t, tags);
      if (p.v == null) return { v: null, kind: p.kind, src: p.note || 'variabel', note, road: roadKind(tags) };
      const src = p.kind === 'sign' ? 'Schild (OSM)' : (p.note || 'Zone');
      return finish(p.v, p.kind, src, note, veh, t, tags);
    }
    // 3. Richtwerte nach Straßenart
    const h = tags.highway || '';
    if (/^motorway/.test(h)) return finish(t.motorway, t.adv ? 'advisory' : 'default', 'Autobahn-Richtwert', note, veh, t, tags);
    if (h === 'living_street') return finish(7, 'default', 'Verkehrsberuhigter Bereich', note, veh, t, tags);
    if (urbanGuess(tags)) return finish(t.urban, 'default', 'Richtwert innerorts', note, veh, t, tags);
    return finish(t.rural, 'default', 'Richtwert außerorts', note, veh, t, tags);
  }

  function urbanGuess(tags) {
    const h = tags.highway || '';
    const zone = [tags['maxspeed:type'], tags['zone:maxspeed'], tags['source:maxspeed'], tags.maxspeed].join(' ');
    if (/urban/.test(zone)) return true;
    if (/^(residential|living_street|service)$/.test(h)) return true;
    if (tags.lit === 'yes' && /^(tertiary|secondary|primary|unclassified|road)/.test(h)) return true;
    if (tags.sidewalk && tags.sidewalk !== 'no' && tags.sidewalk !== 'none' && /^(tertiary|secondary|unclassified)/.test(h)) return true;
    return false;
  }

  function roadKind(tags) {
    const h = tags.highway || '';
    if (/^motorway/.test(h)) return 'Autobahn';
    if (urbanGuess(tags)) return 'Ort';
    return 'Landstraße';
  }

  // Fahrzeugdeckel anwenden (nur außerorts bzw. Autobahn)
  function finish(v, kind, src, note, veh, t, tags) {
    const road = tags ? roadKind(tags) : '';
    let cap = null;
    if (veh && veh.cap && road !== 'Ort') {
      if (v == null) { v = veh.cap; cap = veh.cap; kind = 'default'; }
      else if (v > veh.cap) { cap = veh.cap; v = veh.cap; }
      if (cap) note = (note ? note + ' · ' : '') + 'wegen ' + veh.name;
    }
    return { v, kind, src, note: note || '', road, cap };
  }

  // ---------- Straßen-Cache und Zuordnung ----------
  class Engine {
    constructor() {
      this.roads = []; this.center = null; this.fetchedAt = 0; this.cur = null;
      this.country = 'DE'; this.servers = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
      this.radius = 600;
      this.rot = 0; this.busy = false; this.lastTry = 0; this.error = '';
    }

    query(lat, lon, radius) {
      return `[out:json][timeout:12];way(around:${radius},${lat},${lon})["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road)$"]["service"!~"parking_aisle|driveway|drive-through|emergency_access"];out tags geom;`;
    }

    load(json, lat, lon) {
      const roads = [];
      for (const el of json.elements || []) {
        if (el.type !== 'way' || !el.geometry || el.geometry.length < 2 || !CAR.test((el.tags || {}).highway || '')) continue;
        roads.push({ id: el.id, tags: el.tags || {}, geom: el.geometry.map((g) => ({ lat: g.lat, lon: g.lon })) });
      }
      this.roads = roads; this.center = { lat, lon }; this.fetchedAt = Date.now(); this.byEnd = null;
    }

    // Abruf bei Bedarf: erste Position, mehr als 180 m vom Mittelpunkt, Daten älter als 15 min oder keine Straße gefunden
    // Radius wächst mit dem Tempo: weniger Abfragen bei schneller Fahrt (Overpass sperrt sonst kurz), trotzdem genug Vorlauf
    needFetch(lat, lon, force, speedKmh) {
      this.want = Math.round(Math.min(2500, Math.max(600, (speedKmh || 0) * 16)));
      if (this.busy && Date.now() - this.lastTry < 15000) return false;
      const now = Date.now();
      if (now - this.lastTry < (this.error ? 20000 : 4000)) return false;
      if (!this.center || force) return true;
      if (hav(lat, lon, this.center.lat, this.center.lon) > this.radius * 0.5) return true;
      return now - this.fetchedAt > 15 * 60000;
    }

    async fetchRoads(lat, lon, fetchFn) {
      this.busy = true; this.lastTry = Date.now();
      const rad = this.want || 600; const q = this.query(lat, lon, rad);
      let lastErr = null;
      for (let i = 0; i < this.servers.length; i++) {
        const url = this.servers[(this.rot + i) % this.servers.length];
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const to = setTimeout(() => ctl && ctl.abort(), 9000);
        try {
          // Feste Frist per Wettlauf: in der APK wird ein Abbruch nicht immer beachtet
          const r = await Promise.race([fetchFn(url + '?data=' + encodeURIComponent(q), ctl ? { signal: ctl.signal } : {}), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 9000))]);
          clearTimeout(to);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          this.load(j, lat, lon); this.radius = rad; this.error = ''; this.rot = (this.rot + i) % this.servers.length; this.busy = false;
          return true;
        } catch (e) { clearTimeout(to); lastErr = e; }
      }
      this.error = String((lastErr && lastErr.message) || lastErr || 'Fehler').slice(0, 60);
      this.busy = false;
      return false;
    }

    // Beste Straße für Position und Fahrtrichtung
    match(lat, lon, heading, speedKmh, accuracy) {
      if (!this.roads.length) return null;
      const useDir = heading != null && speedKmh > 8;
      const maxD = Math.min(70, Math.max(28, (accuracy || 15) * 1.6));
      let best = null;
      for (const r of this.roads) {
        const g = r.geom;
        let rd = Infinity, rb = 0, ri = 0;
        for (let i = 0; i < g.length - 1; i++) {
          const [x1, y1] = project(g[i].lat, g[i].lon, lat, lon), [x2, y2] = project(g[i + 1].lat, g[i + 1].lon, lat, lon);
          const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
          let u = l2 ? -(x1 * dx + y1 * dy) / l2 : 0; u = Math.max(0, Math.min(1, u));
          const d = Math.hypot(x1 + u * dx, y1 + u * dy);
          if (d < rd) { rd = d; rb = bearing(x1, y1, x2, y2); ri = i; }
        }
        if (rd > maxD) continue;
        let score = rd, fwd = null;
        if (useDir) {
          const d = angDiff(heading, rb);
          fwd = d < 90;
          const mis = Math.min(d, 180 - d);
          score += mis * 0.45;
          const ow = r.tags.oneway === 'yes' || r.tags.oneway === '1' || /^motorway/.test(r.tags.highway) && r.tags.oneway !== 'no';
          if (ow && !fwd) score += 40;
          if (r.tags.junction === 'roundabout' && !fwd) score += 40;
        }
        if (/^service$/.test(r.tags.highway)) score += 8;
        if (this.cur && this.cur.id === r.id) score -= 10; // Trägheit gegen Springen
        if (!best || score < best.score) best = { road: r, dist: rd, score, fwd, seg: ri, bearing: rb };
      }
      return best;
    }

    // Nächstes Limit voraus (aus Cache): folge der Straße bis zum Ende und nimm die geradeaus weiterführende
    ahead(m, opts, maxAhead) {
      if (!m || m.fwd == null) return null;
      const road = m.road, g = road.geom;
      const order = m.fwd ? g.slice(m.seg + 1) : g.slice(0, m.seg + 1).reverse();
      if (!order.length) return null;
      let dist = hav(opts.lat, opts.lon, order[0].lat, order[0].lon);
      for (let i = 0; i < order.length - 1; i++) dist += hav(order[i].lat, order[i].lon, order[i + 1].lat, order[i + 1].lon);
      const end = order[order.length - 1], prev = order.length > 1 ? order[order.length - 2] : { lat: opts.lat, lon: opts.lon };
      if (dist > maxAhead) return null;
      const outB = (() => { const [x1, y1] = project(prev.lat, prev.lon, end.lat, end.lon); return bearing(x1, y1, 0, 0); })();
      let best = null;
      for (const r of this.roads) {
        if (r === road) continue;
        const gg = r.geom;
        for (const dirFwd of [true, false]) {
          const start = dirFwd ? gg[0] : gg[gg.length - 1];
          if (key(start) !== key(end)) continue;
          const nxt = dirFwd ? gg[1] : gg[gg.length - 2];
          const [x2, y2] = project(nxt.lat, nxt.lon, end.lat, end.lon);
          const turn = angDiff(outB, bearing(0, 0, x2, y2));
          const ow = r.tags.oneway === 'yes' && !dirFwd;
          if (ow) continue;
          if (!best || turn < best.turn) best = { turn, road: r, fwd: dirFwd };
        }
      }
      if (!best || best.turn > 60) return null;
      const lim = wayLimit(best.road.tags, Object.assign({}, opts, { fwd: best.fwd }));
      return { limit: lim, dist: Math.round(dist), name: best.road.tags.name || '' };
    }

    // Ein Schritt je GPS-Fix
    update(o) {
      const m = this.match(o.lat, o.lon, o.heading, o.speed, o.accuracy);
      if (!m) { this.cur = null; return { road: null }; }
      this.cur = m.road;
      const lim = wayLimit(m.road.tags, { fwd: m.fwd, now: o.now, veh: o.veh, country: this.country, wet: o.wet });
      const nxt = this.ahead(m, { lat: o.lat, lon: o.lon, now: o.now, veh: o.veh, country: this.country, wet: o.wet }, 450);
      return {
        road: { id: m.road.id, name: m.road.tags.name || m.road.tags.ref || '', ref: m.road.tags.ref || '', kind: lim.road || roadKind(m.road.tags) },
        limit: lim, next: nxt && (nxt.limit.v !== lim.v) ? nxt : null, dist: m.dist, fwd: m.fwd
      };
    }
  }

  const api = { Engine, wayLimit, parseSpeed, timeCondition, splitConditional, TAB, VEHICLES, hav, angDiff, bearing, project };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Limit = api;
})(typeof window !== 'undefined' ? window : globalThis);
