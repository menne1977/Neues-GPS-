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

    // --- Telefon ---
    const digits = (t) => { const w = { null: 0, eins: 1, ein: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, plus: '+' }; const o = t.split(' ').map((q) => (w[q] != null ? w[q] : q)).join('').replace(/[^0-9+]/g, ''); return o.length >= 3 ? o : null; };
    if (/^(auflegen|leg auf|lege auf|anruf beenden|gespräch beenden|telefonat beenden|beende (den )?anruf)$/.test(s)) return { act: 'phone', a: 'hangup' };
    if (/^(anruf )?(annehmen|abnehmen|rangehen|ran gehen|drangehen)$/.test(s)) return { act: 'phone', a: 'answer' };
    if (/^(wer hat (mich )?angerufen|letzter anruf|letzte anrufe|verpasste anrufe?)$/.test(s)) return { act: 'phone', a: 'recent' };
    if (/^(zurückrufen|rückruf|ruf zurück|rufe zurück)$/.test(s)) return { act: 'phone', a: 'callback' };
    if ((m = s.match(/^(?:die |den |nummer |kontakt )?(erste|ersten|zweite|zweiten|dritte|dritten|vierte|vierten|eins|zwei|drei|vier|1|2|3|4)$/))) return { act: 'phone', a: 'pick', i: { erste: 0, ersten: 0, eins: 0, 1: 0, zweite: 1, zweiten: 1, zwei: 1, 2: 1, dritte: 2, dritten: 2, drei: 2, 3: 2, vierte: 3, vierten: 3, vier: 3, 4: 3 }[m[1]] };
    if ((m = s.match(/^(?:wähle|wählen|anrufen|ruf|rufe)\s+(?:die\s+)?(?:nummer\s+)?([0-9+ ]+|(?:(?:null|eins|ein|zwei|zwo|drei|vier|fünf|sechs|sieben|acht|neun|plus)\s*)+)(?:\s+an)?$/)) && digits(m[1])) return { act: 'phone', a: 'dial', number: digits(m[1]) };
    if ((m = s.match(/^(?:wie (?:ist|lautet) )?(?:die )?(?:telefon)?nummer (?:von|vom|von der) (.+)$/)) || (m = s.match(/^(.+?)s? (?:telefon)?nummer$/))) return { act: 'phone', a: 'number', name: m[1] };
    if ((m = s.match(/^(?:ruf|rufe)\s+(?:bei\s+)?(.+?)\s+an$/)) || (m = s.match(/^(?:anrufen|telefonieren mit|telefoniere mit|anruf an|wähle)\s+(.+)$/)) || (m = s.match(/^(.+?)\s+anrufen$/))) return { act: 'phone', a: 'call', name: m[1].replace(/^(den |die |der |meine |meinen |mein )/, '') };

    // --- Unterwegs: Tankstellen, Stau ---
    if (/(tankstelle|tanken|sprit)/.test(s) && !/(tank(füllung)?\s*(anzeigen|ausblenden)|verstecke|blende)/.test(s)) return { act: 'places', tab: 'fuel' };
    if (/\b(stau|staus|verkehr|autobahn ?meldung\w*|verkehrsmeldung\w*)\b/.test(s) && !/(verstecke|ausblenden|entferne|blende)/.test(s)) return { act: 'places', tab: 'jam' };

    // --- Gesamtkilometer setzen ---
    if ((m = s.match(/gesamt\w*\s*(setzen|stellen)?\s*(auf|zu)\s*(\d[\d. ]*)/))) return { act: 'settotal', n: parseInt(m[3].replace(/[. ]/g, ''), 10) };

    // --- Navigation ---
    if ((m = s.match(/^(navi|navigation|navigationsapp|karten ?app)\s*(auf|ist|mit)?\s*(google|google maps|sygic|andere|fragen|jedes mal)$/))) return { act: 'navi', id: /sygic/.test(m[3]) ? 'sygic' : /google/.test(m[3]) ? 'google' : /andere/.test(m[3]) ? 'geo' : 'ask' };
    if (/(hier|ich habe|ich hab)( \w+)? geparkt|parkplatz (speichern|merken)|(speichere|merke) (den |meinen )?parkplatz|ich parke hier|hier steht mein auto|auto (hier )?geparkt/.test(s)) return { act: 'navsave', kind: 'park' };
    if (/^(zum|zu meinem|zurück zum|zurück zu meinem|bring mich zum|bring mich zu meinem|führe mich zum|führe mich zu meinem|weg zum) (auto|parkplatz)$|wo (habe ich (mein auto )?geparkt|steht mein auto)/.test(s)) return { act: 'navto', q: 'auto' };
    if (/zu fuß weiter|^fußweg$|^zu fuß$|^weiter zu fuß$/.test(s)) return { act: 'navwalk' };
    if ((m = s.match(/(?:speichere|merke|setze|speicher)\s+(?:diesen ort|diese stelle|das|hier|den standort|meinen standort|den ort)?\s*(?:als|auf)\s+(zuhause|zu hause|arbeit|favorit)(?:\s+(.+))?$/))) return { act: 'navsave', kind: m[1] === 'arbeit' ? 'work' : m[1] === 'favorit' ? 'fav' : 'home', label: m[2] || '' };
    if (/^(hier (ist|wohne ich|bin ich) zuhause|hier wohne ich|hier ist zu hause)$/.test(s)) return { act: 'navsave', kind: 'home' };
    if (/^(hier arbeite ich|hier ist (die )?arbeit)$/.test(s)) return { act: 'navsave', kind: 'work' };
    if ((m = s.match(/^(?:karten ?farbe|karte)\s+(nacht|tag|kontrast|natur|grau)$/))) return { act: 'navtheme', id: m[1] };
    if ((m = s.match(/^(?:navi\s+)?(?:erste\s+)?ansage\s+(?:ab|bei|nach|schon bei|früher bei)?\s*(250|500|750|1000|einem|1|ein)\s*(meter|metern|m|kilometer|km)?$|^(?:navi\s+)?ansage nach tempo$/))) { const v = !m[1] ? 'auto' : (/^(einem|1|ein)$/.test(m[1]) || /kilo|km/.test(m[2] || '')) ? '1000' : m[1]; return { act: 'navlook', p: { ann: v }, say: 'Erste Ansage ' + (v === 'auto' ? 'nach Tempo.' : v === '1000' ? 'bei einem Kilometer.' : 'bei ' + v + ' Metern.') }; }
    if ((m = s.match(/^navi\s+(leiste oben|oben|leiste unten|unten|fenster|schwebend|aus|ausblenden|im design)$/))) { const w = m[1], v = /oben/.test(w) ? 'oben' : /unten/.test(w) ? 'unten' : /fenster|schwebend/.test(w) ? 'fenster' : /design/.test(w) ? 'design' : 'aus'; return { act: 'navlook', p: { dock: v }, say: 'Navi ' + ({ oben: 'oben im Tacho', unten: 'unten im Tacho', fenster: 'als Fenster', design: 'im Design', aus: 'ausgeblendet' })[v] + '.' }; }
    if ((m = s.match(/^(?:navi\s+)?(?:pfeil|pfeile|schrift|anzeige)\s+(normal|groß|größer|sehr groß|riesig)$/))) { const v = m[1] === 'normal' ? 'normal' : /sehr|riesig/.test(m[1]) ? 'riesig' : 'gross'; return { act: 'navlook', p: { size: v }, say: 'Navi-Anzeige ' + m[1] + '.' }; }
    if ((m = s.match(/^(?:navi\s+)?pfeil(?:e)?\s+(blau|weiß|gelb|grün|orange|klassisch|schlank|umriss|zeichen)$/))) { const w = m[1], p2 = /klassisch|schlank|umriss|zeichen/.test(w) ? { style: w === 'umriss' ? 'kontur' : w } : { col: { 'weiß': 'weiss', 'grün': 'gruen' }[w] || w }; return { act: 'navlook', p: p2, say: 'Pfeil ' + w + '.' }; }
    if (/^(andere route|alternative route|alternative|route ändern|andere strecke|nächste route)$/.test(s)) return { act: 'navalt', say: 'Ich suche eine andere Route.' };
    if (/^(ankunft teilen|eta teilen|standort teilen|route teilen|meine ankunft teilen)$/.test(s)) return { act: 'navshare', say: 'Ich teile die Ankunft.' };
    if (/^(?:karte\s+)?(nach norden|norden oben|nordausrichtung|nord oben|karte norden)$/.test(s)) return { act: 'naviorient', v: 'north', say: 'Norden oben.' };
    if (/^(?:karte\s+)?(fahrtrichtung oben|nach fahrtrichtung|karte drehen|karte mitdrehen|richtung oben)$/.test(s)) return { act: 'naviorient', v: 'heading', say: 'Fahrtrichtung oben.' };
    if (/^(karte zentrieren|karte mittig|zentrieren|karte zurück|mich zeigen|karte auf mich)$/.test(s)) return { act: 'naviorient', v: 'center', say: 'Karte zentriert.' };
    if (/^(route|navigation|karte)\s+(offline\s+)?(speichern|herunterladen|laden)$|^(route|navigation) offline$|^offline speichern$/.test(s)) return { act: 'navoffline', say: 'Ich speichere die Route offline.' };
    if ((m = s.match(/^offline[- ]route\s+(.+)$/))) return { act: 'navoffline', name: m[1], say: 'Ich starte die Offline-Route.' };
    if ((m = s.match(/^(?:karte\s+)?(zoom|zoome|zoomen)?\s*(rein|näher|vergrößern|raus|weiter weg|verkleinern|automatisch)$/)) && (m[1] || /^(näher|vergrößern|weiter weg|verkleinern)$/.test(m[2]))) return { act: 'navzoom', d: /rein|näher|vergrößern/.test(m[2]) ? 'in' : /automatisch/.test(m[2]) ? 'auto' : 'out' };
    if ((m = s.match(/^(navi|navigation|route|routing)\s+(für\s+|mit\s+)?(das\s+)?(motorrad|auto|pkw|zu fuß|fuß)$/))) { const v = m[4] === 'motorrad' ? 'motorrad' : /fuß/.test(m[4]) ? 'fuss' : 'auto'; return { act: 'navopt', p: { veh: v }, say: 'Navigation: ' + { motorrad: 'Motorrad', fuss: 'zu Fuß', auto: 'Auto' }[v] + '.' }; }
    if ((m = s.match(/\b(wenige|wenig|keine|mittlere|mittel|viele|egal)\s+kurven\b/))) { const k = { wenige: 'wenig', wenig: 'wenig', keine: 'wenig', mittlere: 'mittel', mittel: 'mittel', viele: 'viele', egal: 'egal' }[m[1]]; return { act: 'navopt', p: { veh: 'motorrad', curves: k }, say: { wenig: 'Wenig Kurven.', mittel: 'Mittlere Kurven.', viele: 'Viele Kurven.', egal: 'Kurven egal.' }[k] }; }
    if ((m = s.match(/\b(schnellste|kürzeste|sparsamste|sparsame|längste|gemütliche|ausgewogene|normale)\s+(route|strecke)\b/))) { const k = { schnellste: 'schnell', kürzeste: 'kurz', sparsamste: 'sparsam', sparsame: 'sparsam', längste: 'lang', gemütliche: 'gemuetlich', ausgewogene: 'normal', normale: 'normal' }[m[1]]; return { act: 'navopt', p: { type: k }, say: m[1].charAt(0).toUpperCase() + m[1].slice(1) + ' Route.' }; }
    if ((m = s.match(/\bdurch\s+(den\s+|die\s+|das\s+)?(wald|wälder|felder|feld|wiesen|wasser|seen|heide)\b/))) { const k = { wald: 'wald', wälder: 'wald', felder: 'felder', feld: 'felder', wiesen: 'felder', wasser: 'wasser', seen: 'wasser', heide: 'heide' }[m[2]]; return { act: 'navopt', add: k, say: 'Landschaft: ' + m[2] + '.' }; }
    if (/(landschaft (aus|egal)|ohne landschaft)/.test(s)) return { act: 'navopt', p: { scenic: [] }, say: 'Landschaft egal.' };
    if (/(alles erlauben|nichts vermeiden|vermeiden aus|alle straßen erlauben)/.test(s)) return { act: 'navavoid', id: 'all', on: false, say: 'Alles erlaubt.' };
    if ((m = s.match(/(autobahn|autobahnen|maut|mautstraßen|mautstrassen|fähre|fähren|innenstadt|stadtzentrum|stadtmitte|zentrum)\s*(vermeiden|meiden|umfahren|erlauben|zulassen)|(ohne|keine|nicht durch(?: die)?)\s+(autobahn|autobahnen|maut|mautstraßen|mautstrassen|fähre|fähren|innenstadt|stadt|stadtzentrum)/))) {
      const w = m[1] || m[4], id = /autobahn/.test(w) ? 'autobahn' : /maut/.test(w) ? 'maut' : /fähr/.test(w) ? 'faehre' : 'stadt'; const on = !(m[2] && /erlauben|zulassen/.test(m[2]));
      return { act: 'navavoid', id, on, say: { autobahn: 'Autobahn', maut: 'Mautstraßen', faehre: 'Fähren', stadt: 'Innenstadt' }[id] + (on ? ' wird vermieden.' : ' ist erlaubt.') };
    }
    if (/^(beende|beenden|stoppe|stopp|breche|brich|schalte)\s+(die |das )?(navigation|navi|route|zielführung)( ab| aus)?$|^navigation (beenden|stoppen|aus)$/.test(s)) return { act: 'navstop' };
    if (/wie weit (ist es )?noch|wie lange noch|wann (bin|sind) (ich|wir) da|ankunftszeit|restweg/.test(s)) return { act: 'navinfo' };
    if (/(wiederhole|noch ?mal|noch einmal|sag).*(ansage|abbiegung|abbiegen|anweisung)|^nächste abbiegung$|^was jetzt$/.test(s)) return { act: 'navrepeat' };
    if (/^(zeige|zeig|öffne|öffnen)\s+(mir )?(die )?(karte|navigation|navi|route)$/.test(s)) return { act: 'navshow' };
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

    // --- Einstellungen / Mikrofon ---
    if (/(einstellungen|menü|menu|optionen)/.test(s)) return { act: 'settings', open: !/(schließ|zu\b)/.test(s) };
    if (/(bildschirm anlassen)/.test(s)) return { act: 'toggle', key: 'awake', on: true };

    // Einzelnes Kachelwort wie "Höhe" = Wert vorlesen
    const only = tileOf(s);
    if (only && s.split(' ').length <= 2) return { act: 'ask', what: only };
    return null;
  }

  const HELP = [
    'Wie schnell darf ich fahren?', 'Wie schnell fahre ich?', 'Zeige Höhe', 'Höhe über NAP', 'Ruf Peter an', 'Wähle 0171 1234567', 'Auflegen', 'Annehmen', 'Nummer von Peter', 'Wer hat angerufen', 'Höhe über Normalnull', 'Höhe Ellipsoid', 'Verstecke Beschleunigung', 'Nur Tempo', 'Alle Werte',
    'Thema Nacht / Tag / Neon / Rot', 'Akzentfarbe Orange', 'Querformat / Hochformat / Automatisch drehen',
    'Spalten drei', 'Schrift größer', 'Kacheln kleiner', 'Fahrzeug Motorrad / Auto / Gespann / Lkw',
    'Toleranz fünf', 'Warnton an / aus', 'Limit ansagen an / aus', 'Meilen / Kilometer pro Stunde',
    'Tageskilometer zurücksetzen', 'Höchstgeschwindigkeit zurücksetzen', 'Aktivierungswort ändern auf Cockpit',
    'Sprachantworten aus', 'Lautstärke 60', 'Online aus', 'Einstellungen',
    'Öffne Spotify', 'Schließe YouTube', 'Zurück', 'Startbildschirm', 'Scrolle nach unten', 'Tippe auf Suche', 'Schreibe Hallo', 'Musik Pause', 'Nächster Titel', 'Lauter',
    'Navigiere nach Köln Hauptbahnhof', 'Wie weit noch', 'Navi Motorrad', 'Viele Kurven', 'Kürzeste Route', 'Gemütliche Route durch den Wald', 'Navigation beenden', 'Abbiegung wiederholen', 'Zeige die Karte', 'Karte nach Norden', 'Ansage bei 750 Metern', 'Navi Leiste oben', 'Pfeil groß', 'Pfeil gelb', 'Fahrtrichtung oben', 'Route offline speichern', 'Autobahn vermeiden', 'Ohne Maut', 'Keine Fähren', 'Innenstadt umfahren', 'Alles erlauben', 'Hier geparkt', 'Zurück zum Auto', 'Zu Fuß weiter', 'Navigiere nach Hause', 'Speichere diesen Ort als Arbeit', 'Karte zoom rein', 'Kartenfarbe Tag', 'Tankstellen', 'Stau', 'Split mit Navigation', 'Split beenden', 'Gesamtkilometer auf 12345', 'Navi Sygic'
  ];

  const api = { parse, num, tileOf, HELP, COLORS, THEMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Cmd = api;
})(typeof window !== 'undefined' ? window : globalThis);
