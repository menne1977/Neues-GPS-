// Anleitung und KI-Vorlage. Der KI-Text wird aus den echten Listen der App erzeugt, bleibt also aktuell.
const Guide = (() => {
  const html = () => `
<h3>Eigenen Tacho bekommen</h3>
<ol>
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

  const ai = () => {
    const D = Design;
    return `Du sollst für meine Android-Tacho-App eine Design-Datei im JSON-Format erstellen. Ich gebe dir ein Bild oder eine Beschreibung, wie der Tacho aussehen soll. Antworte NUR mit gültigem JSON (ein Codeblock, keine Erklärung davor oder danach, keine Kommentare im JSON).

FORMAT
{ "format":"tacho-design", "v":1, "name":"Name", "aspect":2.1667, "orient":"land", "bg":{"color":"#070b12","image":"","fit":"cover"}, "els":[ ...Elemente... ] }
- aspect = Breite geteilt durch Höhe der Fläche (quer z. B. 2.1667 für 19.5:9, hochkant z. B. 0.4615). orient = "land" oder "port".
- Alle Elemente liegen auf einer Fläche von 100 x 100 Prozent. Position und Größe sind Prozent dieser Fläche: x, y (linke obere Ecke), w, h. Wichtig: Prozent in Breite und Höhe sind verschieden groß. Ein Kreis braucht deshalb w = h geteilt durch aspect (bei aspect 2.1667 und h 90 ist w etwa 41.5).
- Jedes Element: { "id":"e1", "t":"Typ", "x":0, "y":0, "w":30, "h":20, "rot":0, "op":1, "show":"always", ...typ-spezifische Felder }
- Reihenfolge in "els" = Zeichenreihenfolge, das Letzte liegt oben.

TYPEN UND STANDARDWERTE (Felder weglassen = Standard)
${Object.entries(D.TYPES).map(([k, n]) => `- "${k}" (${n}): ${JSON.stringify(D.DEFAULTS[k])}`).join('\n')}

ERKLÄRUNG DER FELDER
- size = Schriftgröße in Prozent der Flächenhöhe. align: "l", "c", "r". font: ${Object.keys(D.FONTS).join(', ')}. weight: 400 bis 900.
- stc:true = Farbe wechselt nach Tempo zum Limit (grün, gelb, rot).
- bar: Balken von min bis max, segs = Anzahl Segmente (0 = durchgehend), dir "r" oder "l" oder "u", limitMark zeigt das Tempolimit als Strich.
- arc, needle, dial: Rundinstrument. a0 und a1 sind Start- und Endwinkel in Grad (0 = oben, -135 bis 135 ist ein Dreiviertelkreis). Bogen, Nadel und Skala müssen dieselbe x, y, w, h und dieselben min, max, a0, a1 haben. Nadel-len ist Prozent des Radius. dial: step = Beschriftungsabstand, minor = kleine Striche pro Abschnitt.
- value: zeigt einen Wert, "unit" ist ein Text dahinter, "dec" Nachkommastellen.
- sign: das Tempolimit-Schild (rund, wird automatisch quadratisch eingepasst), road: Straßenname, next: nächstes Limit mit Entfernung.
- image: "img" ist eine Data-URL (nur wenn ich ein Bild einbauen will), fit "contain" oder "cover".
- show: ${D.SHOW.map(([v, t]) => `"${v}" (${t})`).join(', ')}.

WERTEQUELLEN für "src" bei value, bar, arc, needle
${D.SRC.map(([k, n]) => `- "${k}": ${n}`).join('\n')}
(Wenn OBD nicht verbunden ist, zeigen die OBD-Werte einen Strich.)

REGELN
- Nichts darf sich unabsichtlich überdecken. Texte brauchen genug Höhe: h mindestens etwa size mal 1.3.
- Das Tempo ist das wichtigste Element: groß und gut lesbar. Schild und Straßenname gehören dazu.
- Benutze nur die oben genannten Typen und Quellen. Farben als "#rrggbb".

MEIN WUNSCH
(Hier Bild anhängen und beschreiben, was wo hin soll und welcher Stil gewünscht ist.)`;
  };
  return { html, ai };
})();
if (typeof module !== 'undefined') module.exports = Guide;
