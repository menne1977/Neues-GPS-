# Tacho (Neues GPS)

Neuer GPS-Tacho als Android-App (Capacitor). Läuft quer und hochkant.

- **Tempo** groß in Echtzeit, mit **Tempo-Schild** und **Fahrband**. Rand und Zahl werden gelb (knapp drüber) und rot (zu schnell), optional Warnton.
- **Live-Tempolimit** aus OpenStreetMap (Overpass): Die Straße wird bei jeder Position lokal zugeordnet, mit Fahrtrichtung (`maxspeed:forward/backward`), Uhrzeit (`maxspeed:conditional`), Nässe (aus Open-Meteo) und Fahrzeug (Auto, Motorrad, Gespann, Lkw). Zusätzlich die Vorschau „gleich 50 in 130 m“. Ein gestrichelter Rand mit ~ bedeutet: kein Schild erfasst, es ist ein Richtwert. Das echte Schild gilt immer.
- **Kacheln** frei wählbar und sortierbar: Höhe, Kompass, Beschleunigung, G-Kraft, Höchsttempo, Ø-Tempo, Fahrzeit, Tages-/Trip-/Gesamtkilometer, Uhrzeit, GPS-Genauigkeit, Satelliten, Wetter, Böen, Steigung, Spielraum zum Limit. Mit OBD2-Adapter zusätzlich Drehzahl, Kühlmittel, Öl, Gas, Last, Spannung, Tank, Verbrauch (nur Lesen).
- **Sprachsteuerung** (Aktivierungswort „Tacho“, einstellbar, oder 🎙 antippen): Alles lässt sich per Sprache einstellen, z. B. „Zeige Höhe“, „Nur Tempo“, „Thema Neon“, „Querformat“, „Toleranz fünf“, „Fahrzeug Motorrad“, „Wie schnell darf ich fahren?“. Liste der Befehle: Einstellungen → Sprachbefehle. Dort kann man Befehle auch eintippen.
- **Online** darf die App für Straßen, Limit und Wetter. Unter Einstellungen → Daten lässt sich das abschalten.

## Dateien

- `www/limit.js` – Tempolimit-Engine (reine Logik)
- `www/voice.js` – Sprachbefehle (reine Logik)
- `www/app.js`, `style.css`, `index.html` – Oberfläche
- `android-overlay/` – Android-Plugins (Satelliten, Sprache mit Aktivierungswort, Hintergrunddienst)
- `.github/workflows/android.yml` – baut bei jedem Push auf `main` die Debug-APK (Artefakt `gps-debug-apk`)

Die App verwaltet ihre Daten unter eigenem Schlüssel und teilt nichts mit der alten App.

Datenquellen: OpenStreetMap-Mitwirkende (ODbL), Open-Meteo. Nur für den privaten Gebrauch.

## Eigene Tachos
Siehe `DESIGN-FORMAT.md`. Beispiele in `designs/`. Creator in der App: Einstellungen → Tacho-Designs.
Weitere Funktionen: Tankstellen und Autobahn-Stau (⛽), Split-Bildschirm (◫), Steuerung anderer Apps per Sprache (Bedienungshilfe nötig).

## Navi (eingebaut)
Der 🧭-Knopf öffnet das eigene Navi: Ziel suchen, Route mit Ansagen, Karte (Fahrtrichtung oder Norden oben, verschiebbar), Motorrad-Modus mit Kurven und Landschaft, Vermeiden (Autobahn, Maut, Fähren, Innenstadt), Zuhause/Arbeit/Favoriten, Parken und „Zu Fuß weiter“, Offline-Routen. Im Tacho zeigt ein kleines Fenster Richtung, nächste Abbiegung und Entfernung. Die Navi-Werte (Abbiegung, Entfernung, Straße, Rest, Ankunft) gibt es auch beim Tacho-Erstellen als Quellen. Mehr in der README von GPS-Navi-.

### Navi-Anzeige im Tacho
- Einstellungen → Tacho-Designs → „Navi im Tacho“: Leiste oben, Leiste unten, schwebendes Fenster, nur im eigenen Design oder aus.
- Im Creator gibt es das Element „Navi-Anzeige“ (Aufbau quer/hoch/nur Pfeil, Pfeil-Stil, Farbe, Kasten). Steckt es im Design, erscheint das Navi genau dort.
- Navi → ⚙ Einstellungen (einklappbar): Pfeil-Stil (Klassisch, Schlank, Umriss, Zeichen), Pfeil-Farbe, Schrift und Pfeil (Normal/Groß/Sehr groß), Hintergrund, „danach“ an/aus.
- Kreisverkehr als Grafik mit Ausfahrt-Nummer und Richtung.
- Erste Ansage vor dem Abbiegen: 250 m, 500 m, 750 m, 1 km oder nach Tempo; danach 200 m und beim Abbiegen.
- Sprache: „Ansage bei 1 Kilometer“, „Navi Leiste unten“, „Pfeile groß“.

### Navi wie Sygic/TomTom (Ausbau)
- **Routenvorschau:** vor dem Start bis zu 3 Routen auf der Übersichtskarte (Zeit, km, Ankunft, Autobahn/Maut/Fähre, Kurven). Start nach 12 s von selbst oder mit „Los“/„Route 2“.
- **Stau auf der Route:** Autobahn-Meldungen (verkehr.autobahn.de) werden mit der Route verglichen. Liegt einer voraus, fragt das Navi „Umfahren?“ (Knopf oder „Ja“/„Nein“). Auch automatisch umfahren möglich.
- **Bahnübergänge:** Warnung vor Bahnübergängen ohne Schranke (OSM-Daten), Ansage und rotes Hinweisfeld, Andreaskreuz auf der Karte.
- **Funkloch-Schutz:** Straßen entlang der Route werden beim Start automatisch gesichert; Karte und Führung laufen ohne Internet weiter.
- **GPS:** Genauigkeit als Anzeige und Kreis auf der Karte; Position rastet auf der Straße ein (abschaltbar).
- **Stimme:** alle deutschen Stimmen des Handys (Mann/Frau, „online“ = natürlich) und Sprechart Normal, Ernst, Ruhig, Lustig, Schnell, Tief, Hoch.
- **Menü:** Kacheln für Ziele, einklappbare Einstellungen; Querformat mit Karte links und Infos rechts.
- **Navi-Designs:** Navi Quer, Navi Hochformat, Navi Split Hoch, Navi Split Quer (Navi auf einem Viertel, Blau-Grau, Tempo grün, Rest gelb, Ankunft orange). Einstellungen → Tacho-Designs → „Navi-Designs verwenden“.
- **Blitzer-Warnung (optional, standardmäßig aus):** feste Blitzer aus OpenStreetMap mit Tempolimit, Ansage etwa 400–900 m vorher. Hinweis: Für Fahrzeugführer (auch Radfahrer) ist die Nutzung während der Fahrt verboten (§ 23 Abs. 1c StVO). Keine mobilen Blitzer.
