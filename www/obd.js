/* OBD2 (ELM327) über das Obd-Plugin: nur Echtzeitwerte lesen. Schreibt nichts ins Fahrzeug. */
(function (root) {
  'use strict';
  const Obd = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Obd;
  // [PID, Schlüssel, Umrechnung, schnell?]
  const PIDS = [
    ['010C', 'rpm', (r) => (r[0] * 256 + r[1]) / 4, 1],
    ['010D', 'spd', (r) => r[0], 1],
    ['0111', 'thr', (r) => r[0] * 100 / 255, 1],
    ['0104', 'load', (r) => r[0] * 100 / 255, 1],
    ['0105', 'cool', (r) => r[0] - 40, 0],
    ['015C', 'oil', (r) => r[0] - 40, 0],
    ['0142', 'volt', (r) => (r[0] * 256 + r[1]) / 1000, 0],
    ['012F', 'fuel', (r) => r[0] * 100 / 255, 0],
    ['0110', 'maf', (r) => (r[0] * 256 + r[1]) / 100, 0],
    ['015E', 'rate', (r) => (r[0] * 256 + r[1]) / 20, 0]
  ];

  const hexSp = (l) => (!/\s/.test(l) && l.length > 2 && l.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(l)) ? l.replace(/(..)/g, '$1 ').trim() : l;
  function lines(txt) {
    return String(txt || '').split(/[\r\n]+/).map((l) => l.trim().replace(/^[0-9A-Fa-f]:\s*/, '')).filter((l) => l && /^[0-9A-Fa-f ]+$/.test(l)).map(hexSp);
  }
  function bytes(txt, pid) {
    const want = '4' + pid.slice(1, 2) + ' ' + pid.slice(2);
    for (const l of lines(txt)) {
      const u = l.toUpperCase().replace(/\s+/g, ' '), i = u.indexOf(want);
      if (i >= 0) return u.slice(i + want.length).trim().split(' ').filter(Boolean).map((h) => parseInt(h, 16));
    }
    return null;
  }

  const O = { on: false, vals: {}, fails: {}, err: '', si: 0, timer: 0, onChange: null };

  async function poll() {
    if (!O.on) return;
    try {
      const act = PIDS.filter((p) => (O.fails[p[1]] || 0) < 3);
      const list = act.filter((p) => p[3]); const slow = act.filter((p) => !p[3]);
      for (let n = 0; n < 2 && slow.length; n++) { list.push(slow[O.si % slow.length]); O.si++; }
      if (!list.length) { O.fails = {}; }
      for (const [cmd, key, fn] of list) {
        if (!O.on) return;
        const r = await Obd.send({ cmd, timeout: 1500 }), b = bytes(r.data, cmd);
        if (b && b.length) { const v = fn(b); if (isFinite(v)) { O.vals[key] = v; O.fails[key] = 0; } else O.fails[key] = (O.fails[key] || 0) + 1; }
        else O.fails[key] = (O.fails[key] || 0) + 1;
      }
      const v = O.vals;
      const rate = v.rate != null ? v.rate : (v.maf != null ? v.maf * 3600 / (14.7 * 745) : null);
      if (rate != null && v.spd > 5) v.l100 = rate * 100 / v.spd; else delete v.l100;
      O.err = '';
      if (O.onChange) O.onChange();
    } catch (e) { O.err = String((e && e.message) || e); drop(); return; }
    O.timer = setTimeout(poll, 20);
  }

  function drop() {
    O.on = false; clearTimeout(O.timer);
    try { if (Obd) Obd.disconnect().catch(() => {}); } catch (_) { /* egal */ }
    if (O.onChange) O.onChange();
  }

  async function connect(cfg) {
    if (!Obd) throw new Error('OBD gibt es nur in der APK');
    if (cfg.type === 'wifi') await Obd.connect({ type: 'wifi', host: cfg.host, port: +cfg.port || 35000 });
    else { if (!cfg.addr) throw new Error('Bitte zuerst einen Adapter wählen'); await Obd.connect({ type: 'bt', address: cfg.addr }); }
    for (const c of ['ATZ', 'ATE0', 'ATL0', 'ATS1', 'ATH0', 'ATSP0']) await Obd.send({ cmd: c, timeout: c === 'ATZ' ? 3000 : 1500 });
    await Obd.send({ cmd: '0100', timeout: 8000 }).catch(() => {});
    O.on = true; O.vals = {}; O.fails = {}; O.err = ''; O.si = 0;
    poll();
  }

  O.connect = connect; O.disconnect = drop; O.available = !!Obd;
  O.devices = async () => (Obd ? (await Obd.devices()).devices || [] : []);
  root.OBDC = O;
})(window);
