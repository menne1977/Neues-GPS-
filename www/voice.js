/* Sprachbefehle: deutscher Text -> Aktion. Reine Logik, ohne Oberfläche, in Node testbar. */
(function (root) {
  'use strict';

  const NUM = { null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
    elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
    zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100 };

  // Zahl aus Text: "fünf", "dreißig", "fünfundzwanzig", "hundertzwanzig", "25"
  function num(s) {
    const m = s.match(/\b(\d+)\b/);
    if (m) return +m[1];
    for (const w of s.split(/\s+/)) {
      const x = w.replace(/[.,!?]/g, '');
      if (NUM[x] != null) return NUM[x];
      let mm = x.match(/^(\w+?)und(\w+)$/);
      if (mm && NUM[mm[1]] != null && NUM[mm[2]] != null) return NUM[mm[1]] + NUM[mm[2]];
      mm = x.match(/^hundert(\w+)$/);
      if (mm) { const r = num(mm[1]); if (r != null) return 100 + r; }
      mm = x.match(/^(\w+)hundert$/);
      if (mm && NUM[mm[1]] != null) return NUM[mm[1]] * 100;
    }
    return null;
  }

  // Kachel-Namen und ihre Schreibweisen
  const TILE_WORDS = [
    ['alt', /höhe|höhenmeter|meereshöhe/],
    ['dir', /kompass|richtung|himmelsrichtung/],
    ['acc', /beschleunigung|bremsen/],
    ['g', /g-kraft|g kraft|fliehkraft|querbeschleunigung|schräglage/],
    ['max', /höchstgeschwindigkeit|höchsttempo|maximum|maximal|spitzentempo|top ?speed/],
    ['avg', /durchschnitt|schnitt/],
    ['time', /fahrzeit|fahrdauer/],
    ['day', /tageskilometer|tagesstrecke|tageskilometerzähler|tagesz[äa]hler/],
    ['trip', /trip|tour|tourenz[äa]hler|reise/],
    ['total', /gesamtkilometer|gesamtstrecke|gesamt/],
    ['clock', /uhrzeit|uhr\b/],
    ['gps', /gps-?genauigkeit|genauigkeit|signal/],
    ['sat', /satelliten|satellit/],
    ['wx', /wetter|außentemperatur|temperatur/],
    ['wind', /wind|böen/],
    ['grade', /steigung|gef[äa]lle/],
    ['free', /reserve|spielraum|luft/],
    ['rpm', /drehzahl|umdrehungen/],
    ['cool', /kühlmittel|kühlwasser|motortemperatur/],
    ['oil', /öltemperatur|öl\b|oil/],
    ['thr', /gaspedal|drossel|gas\b/],
    ['load', /motorlast|last\b/],
    ['volt', /spannung|batterie|bordspannung/],
    ['fuel', /tankf[üu]llung|tank\b|sprit/],
    ['l100', /verbrauch/]
  ];
  function tileOf(s) { for (const [id, re] of TILE_WORDS) if (re.test(s)) return id; return null; }

  const COLORS = { grün: '#3ddc97', gruen: '#3ddc97', blau: '#4aa3ff', orange: '#ff9f2e', rot: '#ff4d4d', gelb: '#ffd84f', pink: '#ff5fd2', türkis: '#2ee6d6', weiß: '#f2f5f8', violett: '#a98bff', lila: '#a98bff' };
  const THEMES = { nacht: 'nacht', dunkel: 'nacht', schwarz: 'schwarz', amoled: 'schwarz', tag: 'tag', hell: 'tag', sonne: 'tag', neon: 'neon', rot: 'rot', nachtsicht: 'rot', blau: 'blau' };
  const VEHICLES = [
    ['motoranhaenger', /motorrad.*(anh[äa]nger|gespann)|(anh[äa]nger|gespann).*motorrad/],
    ['gespann', /anh[äa]nger|gespann|wohnwagen|caravan/],
    ['motorrad', /motorrad|krad|bike/],
    ['lkw', /lkw|laster|transporter|bus/],
    ['auto', /auto|pkw|wagen/]
  ];

  const on = (s) => /\b(an|ein|einschalten|aktiv|aktivieren|ja)\b/.test(s) ? true : /\b(aus|ausschalten|ab|deaktivieren|nein|stopp?)\b/.test(s) ? false : null;

  // Hauptfunktion. Liefert {act, ...} oder null.
  function parse(text) {
    let s = String(text || '').toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    s = s.replace(/^(hey |hallo |ok |okay |bitte |tacho |sag mal )+/, '').replace(/ bitte$/, '').trim();
    let m;

    // --- Hilfe ---
    if (/^(hilfe|befehle|was kann ich sagen|was kannst du)/.test(s)) return { act: 'help' };

    // --- Unterwegs: Tankstellen, Stau ---
    if (/(tankstelle|tanken|sprit)/.test(s) && !/(tank(füllung)?\s*(anzeigen|ausblenden)|verstecke|blende)/.test(s)) return { act: 'places', tab: 'fuel' };
    if (/\b(stau|staus|verkehr|autobahn ?meldung\w*|verkehrsmeldung\w*)\b/.test(s) && !/(verstecke|ausblenden|entferne|blende)/.test(s)) return { act: 'places', tab: 'jam' };

    // --- Gesamtkilometer setzen ---
    if ((m = s.match(/gesamt\w*\s*(setzen|stellen)?\s*(auf|zu)\s*(\d[\d. ]*)/))) return { act: 'settotal', n: parseInt(m[3].replace(/[. ]/g, ''), 10) };

    // --- Navigation ---
    if ((m = s.match(/^(navi|navigation|navigationsapp|karten ?app)\s*(auf|ist|mit)?\s*(google|google maps|sygic|andere|fragen|jedes mal)$/))) return { act: 'navi', id: /sygic/.test(m[3]) ? 'sygic' : /google/.test(m[3]) ? 'google' : /andere/.test(m[3]) ? 'geo' : 'ask' };
    if ((m = s.match(/^(navigiere|navigation|route|fahre|bring mich|leite mich)\s*(mich )?(nach|zu|zum|zur)\s+(.+)$/))) return { act: 'navto', q: m[4] };

    // --- Andere Apps steuern ---
    if (/^(zurück zum tacho|tacho (zeigen|nach vorne|vorne)|zeige (den )?tacho|zurück zur app)$/.test(s)) return { act: 'sys', a: 'front' };
    if (/^(zurück|geh zurück|gehe zurück)$/.test(s)) return { act: 'sys', a: 'back' };
    if (/^(startbildschirm|home|nach hause|home ?screen|zum startbildschirm)$/.test(s)) return { act: 'sys', a: 'home' };
    if (/^(app ?übersicht|letzte apps|zuletzt benutzt)$/.test(s)) return { act: 'sys', a: 'recents' };
    if (/^(benachrichtigungen|mitteilungen)( öffnen| zeigen)?$/.test(s)) return { act: 'sys', a: 'notifications' };
    if (/(scroll\w*|blättere|wische)\s*(nach )?(unten|runter|weiter)/.test(s)) return { act: 'scroll', down: true };
    if (/(scroll\w*|blättere|wische)\s*(nach )?(oben|hoch)/.test(s)) return { act: 'scroll', down: false };
    if ((m = s.match(/^(tippe|klicke|klick|drücke|drück|wähle|auswählen)\s*(auf|den|die|das)?\s*(.+)$/)) && !/zeige|ausblenden/.test(s)) return { act: 'click', text: m[3] };
    if ((m = s.match(/^(schreibe|schreib|tippe ein|diktiere|gib ein)\s+(.+)$/))) return { act: 'type', text: m[2] };
    if (/^(musik |medien )?(pause|pausieren|anhalten|stopp)( musik)?$/.test(s)) return { act: 'media', key: 'pause' };
    if (/^(musik |medien )?(weiter|fortsetzen|abspielen|play|spiele|starte musik|musik an)$/.test(s)) return { act: 'media', key: 'play' };
    if (/(nächster|nächstes|nächsten) (titel|song|lied)|überspringen|skip/.test(s)) return { act: 'media', key: 'next' };
    if (/(vorheriger|vorheriges|vorherigen|letzter|letzten) (titel|song|lied)/.test(s)) return { act: 'media', key: 'prev' };
    if (/(musik|medien).*(lauter|leiser)|^(lauter|leiser)$/.test(s)) return { act: 'sysvol', up: /lauter/.test(s) };
    if (/(split|geteilt|teilen|teile)/.test(s) && /(beend|aus|schließ|nicht mehr|zurück)/.test(s)) return { act: 'split', off: true };
    if ((m = s.match(/(split\w*|geteilter? bildschirm|bildschirm teilen|teile (den )?bildschirm)(?: mit| und| für)?\s*(.*)$/))) return { act: 'split', name: (m[3] || '').replace(/^(der |die |dem |den |das |einer |mit )+/, '').trim() };
    if (/^(schließe|schließen|beende|beenden|kill)\s*(die |diese )?(aktuelle )?app$|^app (schließen|beenden)$/.test(s)) return { act: 'closeapp', name: '' };
    if ((m = s.match(/^(schließe|schließen|beende|beenden)\s+(die |den |das )?(.+)$/)) && !/(einstellung|menü|optionen|tacho)/.test(m[3])) return { act: 'closeapp', name: m[3].replace(/ app$/, '') };
    if ((m = s.match(/^(öffne|öffnen|starte|starten|start|mach|mache|gehe zu|geh zu|zeige)\s+(die |den |das |mir )*(.+?)( auf)?$/)) && !/(einstellung|menü|optionen|tankstelle|stau|höhe|kompass|tempo|alle|nur|trip|tour|wetter|uhr|beschleunigung|g-kraft|fahrzeit|durchschnitt|steigung|drehzahl|satelliten|gesamt|tages|höchst|spielraum|wind|genauigkeit|kühl|öl|gas|last|spannung|tank|verbrauch|obd)/.test(m[3])) {
      if (/^(navi|navigation|karte|karten|maps|google maps)$/.test(m[3])) return { act: 'openapp', name: '', navi: true };
      return { act: 'openapp', name: m[3] };
    }

    // --- Abfragen ---
    if (/(wie schnell darf|welches (tempo)?limit|tempolimit|geschwindigkeitsbegrenzung|was ist erlaubt|erlaubt|limit)\b/.test(s) && !/(setz|stell|größer|kleiner|ansag|warn)/.test(s)) return { act: 'ask', what: 'limit' };
    if (/wie schnell (fahre|bin) ich|mein tempo|aktuelles tempo|geschwindigkeit$/.test(s)) return { act: 'ask', what: 'speed' };
    if (/höhe.*(nap|n a p|amsterdam)/.test(s)) return { act: 'altref', id: 'nap' };
    if (/höhe.*(ellipsoid|achse|wgs|gps ?höhe)/.test(s)) return { act: 'altref', id: 'ell' };
    if (/höhe.*(normal ?null|n n\b|nn\b|meer)/.test(s)) return { act: 'altref', id: 'nn' };
    if (/wie (hoch|viele höhenmeter)|welche höhe/.test(s)) return { act: 'ask', what: 'alt' };
    if (/wie sp[äa]t|uhrzeit|wie viel uhr/.test(s)) return { act: 'ask', what: 'clock' };
    if (/welche richtung|wohin fahre ich|kompass$/.test(s)) return { act: 'ask', what: 'dir' };
    if (/wie (wird|ist) das wetter|wetter$|wie warm|wie kalt/.test(s)) return { act: 'ask', what: 'wx' };
    if (/wie (viele|weit).*(kilometer|km|gefahren)|tageskilometer$|wie weit bin ich/.test(s)) return { act: 'ask', what: 'day' };
    if (/wie lange (bin ich|fahre ich)|fahrzeit$/.test(s)) return { act: 'ask', what: 'time' };
    if (/wie viel (drehzahl|umdrehungen)|^drehzahl$/.test(s)) return { act: 'ask', what: 'rpm' };

    // --- Zähler zurücksetzen ---
    if (/(zurücksetzen|auf null|null setzen|nullen|neu starten|löschen|reset)/.test(s) || /\bnull\b/.test(s)) {
      if (/(höchst|maximum|maximal|spitze)/.test(s)) return { act: 'reset', what: 'max' };
      if (/(trip|tour)/.test(s)) return { act: 'reset', what: 'trip' };
      if (/(tag|tageskilometer|tagesstrecke)/.test(s)) return { act: 'reset', what: 'day' };
      if (/(durchschnitt|fahrzeit)/.test(s)) return { act: 'reset', what: 'avg' };
      if (/(gesamt)/.test(s)) return { act: 'reset', what: 'total' };
    }

    // --- Fahrzeug ---
    if (/(fahrzeug|ich fahre|profil|modus)/.test(s) || /^(auto|motorrad|lkw|gespann)\b/.test(s)) {
      for (const [id, re] of VEHICLES) if (re.test(s)) return { act: 'vehicle', id };
    }
    if (/anh[äa]nger/.test(s) && on(s) !== null) return { act: 'trailer', on: on(s) };

    // --- Aktivierungswort ändern ---
    if ((m = s.match(/(aktivierungswort|weckwort|rufwort|schlüsselwort)\s*(ändern|setzen|neu)?\s*(auf|zu|ist)?\s*([a-zäöüß]{3,})$/)) && !/\b(an|aus|ein)$/.test(s)) return { act: 'wakeword', word: m[4] };

    // --- Schalter ---
    const sw = [
      ['beep', /warnton|piepton|signalton|piep\b/], ['warnSpeak', /warnansage|warnung ansagen|sprachwarnung/],
      ['announce', /limit ansagen|ansage bei neuem limit|limitansage|neues limit ansagen|tempolimit ansagen/],
      ['replies', /sprachantwort|antworten/], ['wake', /aktivierungswort|immer zuhören|dauerhaft zuhören|dauerlauschen|mikrofon dauerhaft/],
      ['awake', /bildschirm (anlassen|anlass|an lassen|anbleiben)|display anlassen|nicht ausschalten/],
      ['online', /\bonline\b|internet/], ['preview', /vorschau|nächstes limit|limit voraus/], ['decimals', /nachkomma/],
      ['appCtl', /andere apps|apps bedienen|appsteuerung|app steuerung|apps steuern/], ['wxOn', /wetter online|wetterdaten/], ['satOn', /satelliten abfragen|satellitenanzeige/], ['bt', /bluetooth/]
    ];
    for (const [k, re] of sw) if (re.test(s) && on(s) !== null) return { act: 'toggle', key: k, on: on(s) };

    // --- Einheit ---
    if (/(kilometer pro stunde|km\/h|kmh|kilometer)/.test(s) && /(einheit|umstellen|auf|anzeigen|zeige)/.test(s) && !/(tages|gesamt|trip|zeige.*(tageskilometer|tagesstrecke))/.test(s)) return { act: 'unit', id: 'kmh' };
    if (/(meilen|mph|miles)/.test(s)) return { act: 'unit', id: 'mph' };

    // --- Toleranz ---
    if (/toleranz/.test(s)) { const n = /aus|keine|null/.test(s) ? 0 : num(s); return n == null ? null : { act: 'tol', n }; }

    // --- Lautstärke der Antworten ---
    if ((m = s.match(/(lautstärke|stimme).*?(\d+|[a-zäöüß]+)/)) && /lautstärke/.test(s)) {
      if (/lauter|höher/.test(s)) return { act: 'volume', delta: 15 };
      if (/leiser|niedriger/.test(s)) return { act: 'volume', delta: -15 };
      const n = num(s); if (n != null) return { act: 'volume', n: Math.min(100, n) };
    }
    
    // --- Layout ---
    if (/(querformat|quer\b|waagerecht|waagrecht|landscape)/.test(s) && !/spalte/.test(s)) return { act: 'layout', id: 'land' };
    if (/(hochformat|hochkant|senkrecht|portrait|aufrecht)/.test(s)) return { act: 'layout', id: 'port' };
    if (/(automatisch|auto)\b.*(dreh|ausricht|layout)|(dreh|ausricht|layout).*(automatisch|auto)\b/.test(s)) return { act: 'layout', id: 'auto' };
    if ((m = s.match(/(spalten|kacheln pro zeile)\D*(\d+|[a-zäöüß]+)?/)) || (m = s.match(/(\d+|[a-zäöüß]+)\s*spalten/))) {
      const n = num(s); if (n != null && n >= 1 && n <= 5) return { act: 'cols', n };
    }
    if (/(schrift|tempo|zahl|ziffern|geschwindigkeit).*(größer|vergrößern)|(größer).*(schrift|tempo)/.test(s)) return { act: 'size', what: 'hero', delta: +0.1 };
    if (/(schrift|tempo|zahl|ziffern|geschwindigkeit).*(kleiner|verkleinern)|(kleiner).*(schrift|tempo)/.test(s)) return { act: 'size', what: 'hero', delta: -0.1 };
    if (/kacheln.*(größer|vergrößern)|(größer).*kacheln/.test(s)) return { act: 'size', what: 'tiles', delta: +0.1 };
    if (/kacheln.*(kleiner|verkleinern)|(kleiner).*kacheln/.test(s)) return { act: 'size', what: 'tiles', delta: -0.1 };

    // --- Farben ---
    if ((m = s.match(/(akzent|farbe|farben)\w*\s*(auf|zu)?\s*([a-zäöüß]+)$/)) && COLORS[m[3]]) return { act: 'accent', color: COLORS[m[3]], name: m[3] };
    if ((m = s.match(/(thema|design|stil|modus|ansicht)\s*(auf|zu)?\s*([a-zäöüß]+)$/)) && THEMES[m[3]]) return { act: 'theme', id: THEMES[m[3]] };
    if (/^(nachtmodus|dunkel|hell|tagmodus|nachtmodus an|tagmodus an)$/.test(s)) return { act: 'theme', id: /hell|tag/.test(s) ? 'tag' : 'nacht' };

    // --- Kacheln ein-/ausblenden ---
    if (/^(nur tempo|nur geschwindigkeit|alles ausblenden|nur das tempo)/.test(s)) return { act: 'only' };
    if (/^(alle werte|alles anzeigen|alles zeigen|alles einblenden|alle kacheln)/.test(s)) return { act: 'all' };
    if (/^(standard|grundeinstellung|werkseinstellung|standardansicht)/.test(s)) return { act: 'default' };
    if (/(zeige|zeig|einblenden|blende.*ein|hinzufügen|füge.*hinzu|aktiviere|anzeigen|mit)/.test(s)) {
      const id = tileOf(s); if (id) return { act: 'tile', id, on: true };
    }
    if (/(verstecke|verstecken|ausblenden|blende.*aus|entferne|entfernen|weg mit|ohne|deaktiviere|nicht mehr anzeigen)/.test(s)) {
      const id = tileOf(s); if (id) return { act: 'tile', id, on: false };
    }
    if (/(nach oben|nach vorn|weiter oben|zuerst)/.test(s)) { const id = tileOf(s); if (id) return { act: 'move', id, dir: -1 }; }
    if (/(nach unten|nach hinten|weiter unten|zuletzt)/.test(s)) { const id = tileOf(s); if (id) return { act: 'move', id, dir: +1 }; }

    // --- Einstellungen / OBD / Mikrofon ---
    if (/(einstellungen|menü|menu|optionen)/.test(s)) return { act: 'settings', open: !/(schließ|zu\b)/.test(s) };
    if (/obd/.test(s)) return { act: 'obd', on: on(s) !== false };
    if (/(bildschirm anlassen)/.test(s)) return { act: 'toggle', key: 'awake', on: true };

    // Einzelnes Kachelwort wie "Höhe" = Wert vorlesen
    const only = tileOf(s);
    if (only && s.split(' ').length <= 2) return { act: 'ask', what: only };
    return null;
  }

  const HELP = [
    'Wie schnell darf ich fahren?', 'Wie schnell fahre ich?', 'Zeige Höhe', 'Höhe über NAP', 'Höhe über Normalnull', 'Höhe Ellipsoid', 'Verstecke Beschleunigung', 'Nur Tempo', 'Alle Werte',
    'Thema Nacht / Tag / Neon / Rot', 'Akzentfarbe Orange', 'Querformat / Hochformat / Automatisch drehen',
    'Spalten drei', 'Schrift größer', 'Kacheln kleiner', 'Fahrzeug Motorrad / Auto / Gespann / Lkw',
    'Toleranz fünf', 'Warnton an / aus', 'Limit ansagen an / aus', 'Meilen / Kilometer pro Stunde',
    'Tageskilometer zurücksetzen', 'Höchstgeschwindigkeit zurücksetzen', 'Aktivierungswort ändern auf Cockpit',
    'Sprachantworten aus', 'Lautstärke 60', 'Online aus', 'Einstellungen',
    'Öffne Spotify', 'Schließe YouTube', 'Zurück', 'Startbildschirm', 'Scrolle nach unten', 'Tippe auf Suche', 'Schreibe Hallo', 'Musik Pause', 'Nächster Titel', 'Lauter',
    'Navigiere nach Köln Hauptbahnhof', 'Tankstellen', 'Stau', 'Split mit Navigation', 'Split beenden', 'Gesamtkilometer auf 12345', 'Navi Sygic'
  ];

  const api = { parse, num, tileOf, HELP, COLORS, THEMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Cmd = api;
})(typeof window !== 'undefined' ? window : globalThis);
