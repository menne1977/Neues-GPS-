// Anleitung und KI-Vorlage. Der KI-Text wird aus den echten Listen der App erzeugt, bleibt also aktuell.
const Guide = (() => {
  const html = () => `
<h3>Eigenen Tacho bekommen</h3>
<ol>
<li><b>Wie das Bild aussehen:</b> Gib der KI dein Bild und schreibe dazu: „Mache den Tacho so, dass er dem Bild gleicht.“ Der KI-Text sagt ihr schon, wie Verläufe, Leuchten und Metall gehen. Willst du es pixelgenau, lade dein Bild im Creator unter „Hintergrund“ ein. Die KI setzt dann nur die Werte darauf.</li>
<li><b>Selbst bauen:</b> Einstellungen → Tacho-Designs → „Eigenen Tacho erstellen“. Unten Elemente antippen (+ Wert, + Nadel …), mit dem Finger verschieben, an der Ecke vergrößern, unten Eigenschaften ändern. „Speichern“ legt ihn in der App ab.</li>
<li><b>Von mir oder einer anderen KI bauen lassen:</b> „KI-Text kopieren“ drücken, in die andere KI einfügen, dein Bild dazu geben und beschreiben, was wo hin soll. Die KI antwortet mit einem Text im JSON-Format. Diesen Text als Datei <code>meinname.tacho.json</code> speichern.</li>
<li><b>Datei laden:</b> Einstellungen → Tacho-Designs → „Design-Datei laden“. Oder „Text einfügen“, dann musst du keine Datei speichern.</li>
<li><b>Benutzen:</b> Oben bei „Tacho quer“ oder „Tacho hochkant“ das Design wählen. „Kacheln (Standard)“ bringt den normalen Tacho zurück.</li>
<li><b>Sichern:</b> Bei jedem Design „Export“ drücken, die Datei ist deine Sicherung.</li>
</ol>
<h3>Tipps für gute Bilder</h3>
<ul><li>Zeichne die Fläche im Seitenverhältnis deines Handys quer (zum Beispiel 19,5:9) oder hochkant.</li>
<li>Schreibe in jedes Feld, was hinein soll: „Tempo groß“, „Höhe“, „Uhrzeit“, „Tempo-Schild“, „Nadel“.</li>
<li>Schönheit (Farben, Rahmen) darf die KI frei wählen, wenn du nichts sagst.</li></ul>
<h3>Sprache</h3>
<p>Sage zuerst das Weckwort, dann zum Beispiel: „Zeige Gesamtkilometer“, „Öffne Spotify“, „Split mit Navigation“, „Tankstellen“, „Stau“. Alle Befehle stehen unter „Sprachbefehle und Test“.</p>`;

  // Gruppen für die Auswahl vor dem Erstellen
  const GROUPS = [
    ['Fahren', ['speed', 'limit', 'free', 'max', 'avg', 'acc', 'g']],
    ['Strecke und Zeit', ['trip', 'day', 'total', 'time', 'clock', 'date']],
    ['Ort und Richtung', ['dirname', 'dir', 'alt', 'altnn', 'altnap', 'altell', 'grade', 'roadname', 'ref', 'gps', 'sat', 'lat', 'lon']],
    ['Wetter', ['temp', 'feels', 'gust', 'wind', 'winddir', 'hum', 'rain', 'wx']],
    ['Handy', ['battery']]
  ];
  const PARTS = [['sign', 'Tempo-Schild'], ['road', 'Straßenname-Zeile'], ['next', 'Nächstes Limit'], ['gauge', 'Rundinstrument Tempo mit Nadel'], ['bar', 'Tempo-Balken mit Limit-Strich']];
  const DEF = { orient: 'land', aspect: '2.1667', look: 'real', srcs: ['speed', 'max', 'trip', 'day', 'total', 'time', 'clock', 'dirname', 'alt', 'temp'], parts: ['sign', 'road', 'next', 'bar'], colors: '', notes: '' };

  const EXAMPLE = {
    format: 'tacho-design', v: 1, name: 'Beispiel', aspect: 2.1667, orient: 'land',
    bg: { color: '#03060e', grad: 'radial-gradient(ellipse at 50% 55%,#0e2146 0%,#060d1e 60%,#03060e 100%)' },
    els: [
      { id: 'e1', t: 'rect', x: 2, y: 8, w: 38.8, h: 84, shape: 'circle', rgrad: '#173a78,#08142c', border: 2.2, bgrad: '#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb', bmode: 'conic', drop: true, inner: '#2f7bff66', ins: 5 },
      { id: 'e2', t: 'arc', x: 3.8, y: 12, w: 35.2, h: 76, src: 'kmh', min: 0, max: 240, a0: -130, a1: 130, thick: 6, grad: '#00d0ff,#3cff9a,#ffd23c,#ff2b1c', bg: '#0f1a33', glow: '#2a8bff', gs: 1 },
      { id: 'e3', t: 'dial', x: 5.4, y: 15.5, w: 32, h: 69, min: 0, max: 240, step: 20, minor: 3, a0: -130, a1: 130, color: '#e8f1ff', size: 2.6, red: 200, band: [[200, 240, '#ff3b30']], italic: true, lim: true },
      { id: 'e4', t: 'needle', x: 3.8, y: 12, w: 35.2, h: 76, src: 'kmh', min: 0, max: 240, a0: -130, a1: 130, len: 82, width: 1.6, tail: 10, color: '#ff4030', glow: '#ff3b2e', gs: 0.7, shadow: true },
      { id: 'e5', t: 'value', x: 11.4, y: 54, w: 20, h: 16, src: 'speed', size: 13, weight: 900, font: 'condensed', color: '#ffffff', tgrad: '#ffffff,#9fd0ff', glow: '#2a8bff', gs: 0.8 },
      { id: 'e6', t: 'text', x: 11.4, y: 70, w: 20, h: 5, text: 'KM/H', size: 3, color: '#8aa2d0', weight: 700 },
      { id: 'e7', t: 'rect', x: 46, y: 8, w: 24, h: 26, grad: '#18284a,#0b1426', gang: 160, radius: 10, border: 0.6, bgrad: '#4a78c8,#1b2c52', bmode: 'linear', bang: 160, shine: 0.07, drop: true },
      { id: 'e8', t: 'text', x: 46, y: 10, w: 24, h: 6, text: 'GESAMT', size: 3.4, color: '#8aa2d0', weight: 700 },
      { id: 'e9', t: 'value', x: 46, y: 17, w: 24, h: 13, src: 'total', unit: ' km', size: 8, weight: 800, font: 'condensed', tgrad: '#ffffff,#b8d6ff' },
      { id: 'e10', t: 'sign', x: 76, y: 8, w: 20, h: 40 }
    ]
  };

  const ai = (o) => {
    const D = Design; o = Object.assign({}, DEF, o || {});
    const name = (k) => (D.SRC.find((s) => s[0] === k) || [k, k])[1];
    const srcs = (o.srcs && o.srcs.length ? o.srcs : D.SRC.map((s) => s[0]));
    const parts = o.parts || [];
    const lookTxt = o.look === 'image'
      ? 'MEIN BILD WIRD DER HINTERGRUND: Ich lade mein Bild später im Creator als Hintergrund. Lasse bg.image leer, setze "aspect" genau auf Breite geteilt durch Höhe des Bildes und lege nur die Werte-Elemente (value, needle, arc, sign, road, next) genau auf die Stellen im Bild, wo die Zahlen und Zeiger stehen. Keine eigenen Flächen (rect) zeichnen. Schrift und Farbe passend zum Bild.'
      : o.look === 'flat'
        ? 'STIL: schlicht und flach, klare Kacheln, wenig Effekte, gut lesbar.'
        : 'STIL: SO ECHT WIE MÖGLICH. Übernimm Farben, Anordnung und Wirkung meines Bildes genau. Benutze reichlich Verläufe, Leuchten, Chromringe, Glasglanz und Schatten (siehe EFFEKTE). Keine flachen Einzelfarben, wenn das Bild Verläufe zeigt.';
    return `Du erstellst eine Design-Datei (JSON) für meine Android-Tacho-App. Antworte NUR mit dem JSON in einem Codeblock. Kein Text davor oder danach, keine Kommentare im JSON, keine Abkürzungen wie "...". Schreibe die komplette Datei.

AUFBAU (genau diese Schlüssel verwenden, nichts erfinden)
{ "format":"tacho-design", "v":1, "name":"Name", "aspect":${o.aspect}, "orient":"${o.orient}", "bg":{"color":"#rrggbb","grad":"radial-gradient(...)"}, "els":[ ... ] }
- aspect = Breite durch Höhe. Nimm GENAU ${o.aspect}, das ist die echte Fläche in der App${o.px ? ' (' + o.px + ' Pixel)' : ''}. ${o.split ? 'Das ist ein GETEILTER BILDSCHIRM (halbe Fläche, fast quadratisch): wenige, große Anzeigen, Tempo sehr groß, kleine Schrift vermeiden (size mindestens 4).' : o.orient === 'port' ? 'Hochkant, also kleiner als 1.' : 'Quer, die ganze Breite nutzen.'} Fülle die Fläche komplett aus, ohne leere Ränder. Verteile die Elemente über die ganze Fläche von 0 bis 100 Prozent in Breite und Höhe. Im geteilten Bildschirm wird das Design auf die halbe Fläche gestreckt, also keine Ränder einplanen.
- Jedes Element hat "id", "t" (Typ), "x", "y", "w", "h" in PROZENT der Fläche (0 bis 100). x+w und y+h höchstens 100.
- Prozent in Breite und Höhe sind verschieden groß! Für einen Kreis gilt: w = h / aspect (bei aspect ${o.aspect} und h 80 ist w ${(80 / parseFloat(o.aspect)).toFixed(1)}).
- Spätere Elemente liegen über früheren. Zuerst Flächen, dann Bögen und Skalen, dann Nadeln, dann Zahlen.
- Farben nur als "#rrggbb" oder "#rrggbbaa". Zahlen ohne Anführungszeichen.

TYPEN ("t") UND IHRE FELDER (nur diese Typen gibt es)
- "text": feste Beschriftung. text, size, color, font, weight, align, tgrad, glow
- "value": zeigt einen LIVE-WERT. src (Pflicht, siehe WERTE), unit (Text dahinter, z. B. " km"), dec (Nachkommastellen), size, color, font, weight, align, stc, tgrad, glow
- "bar": Balken. src, min, max, dir ("r","l","u","d"), color, grad, bg, radius, segs (Anzahl Segmente, 0 = durchgehend), limitMark (Limit-Strich), stc
- "arc": Bogen eines Rundinstruments. src, min, max, a0, a1 (Grad, 0 = oben, z. B. -130 bis 130), thick, color oder grad, bg, glow, dim
- "needle": Zeiger. src, min, max, a0, a1 (GLEICH wie der Bogen), len (Prozent des Radius), width (1 bis 2), tail, color, glow, shadow, hub
- "dial": Skala mit Zahlen. min, max, step, minor, a0, a1, color, size (2 bis 4), red, redColor, band, italic, lim. Wichtig: min und max der Skala sind die angezeigten Zahlen (Tempo z. B. 0 bis 240), bei Bogen und Nadel dagegen die echten Werte.
- "rect": Fläche, Kachel, Kreis oder Ring. color oder grad (mit gang) oder rgrad, radius (Prozent), shape:"circle", border, borderColor oder bgrad mit bmode ("conic" für Ringe, "linear" mit bang), shine, inner (mit ins), rglow (mit rgs), drop
- "sign": rundes Tempolimit-Schild (passt sich selbst an)
- "road": Name der aktuellen Straße. size, color, font, weight, align
- "next": nächstes Tempolimit mit Entfernung. size
- "image": nur wenn ich ein Bild mitgebe, "img" als data:-URL
Weitere Felder bei allen: "rot" (Drehung), "op" (0 bis 1), "show": "always" | "over" (nur zu schnell) | "hasLimit".
size ist die Schriftgröße in Prozent der Flächenhöhe. h muss mindestens size × 1,3 sein, sonst wird abgeschnitten. font: "sans","condensed","mono","serif". weight: 400, 600, 800 oder 900. align: "l","c","r". stc:true färbt nach Tempolimit (grün, gelb, rot).

EFFEKTE (machen den Tacho echt)
- glow:"#2a8bff" und gs:1 = Leuchten. shadow:true = Schlagschatten.
- tgrad:"#ffffff,#9fd0ff" = Zahl mit Farbverlauf.
- grad / rgrad / bgrad: Farben mit Komma getrennt, z. B. "#ff0000,#ffd000,#00ff00".
- Chromring: rect shape:"circle", border:2.2, bgrad:"#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb,#79808e,#e3e7ee,#3d4350,#f4f7fb", bmode:"conic".
- Regenbogen-Rahmen: rect mit radius, border:1.3, bgrad:"#ff2bd6,#7a3cff,#2b8cff,#00e5ff,#2bff7a,#ffe92b,#ff9a2b,#ff2b4a,#ff2bd6", bmode:"conic", rglow.
- Glasscheibe über einem Instrument: rect shape:"circle", color:"#00000000", shine:0.1.
- Hintergrund-Verlauf in bg.grad: "radial-gradient(ellipse at 50% 50%,#13243f 0%,#050a14 100%)" oder "linear-gradient(180deg,#111 0%,#000 100%)".

WERTE für "src" (NUR diese Namen, genau so geschrieben)
${srcs.map((k) => `- "${k}": ${name(k)}`).join('\n')}

GEWÜNSCHTER INHALT (alles davon soll vorkommen)
- Werte: ${srcs.map((k) => name(k)).join(', ')}
${parts.length ? '- Bauteile: ' + parts.map((p) => (PARTS.find((x) => x[0] === p) || [p, p])[1]).join(', ') : ''}
${o.colors ? '- Farben: ' + o.colors : ''}
${o.notes ? '- Sonstiges: ' + o.notes : ''}
${o.px ? '- Wenn du ein Bild als Vorlage malst: ' + o.px + ' Pixel.' : ''}

${lookTxt}

FUNKTIONIERENDES BEISPIEL (Aufbau genau so übernehmen, Inhalt nach meinem Wunsch ändern)
${JSON.stringify(EXAMPLE)}

PRÜFE VOR DER ANTWORT
1. Jedes "value", "bar", "arc" und "needle" hat ein "src" aus der Liste WERTE.
2. Nadel und Bogen eines Instruments haben gleiche x, y, w, h, min, max, a0, a1.
3. Nichts ragt über 100, nichts überdeckt Zahlen ungewollt.
4. Gültiges JSON ohne Kommentare und ohne Komma am Ende von Listen.

MEIN WUNSCH
(Hier dein Bild anhängen und beschreiben, was wo hin soll.)`;
  };
  return { html, ai, GROUPS, PARTS, DEF };
})();
if (typeof module !== 'undefined') module.exports = Guide;
