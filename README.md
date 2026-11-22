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
