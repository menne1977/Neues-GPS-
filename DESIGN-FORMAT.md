# Tacho-Design-Format (`.tacho.json`)

Eine Datei = ein Tacho. Laden in der App: Einstellungen → Tacho-Designs → „Design-Datei laden“ oder „Designs vom Server holen“ (Ordner `designs/` in diesem Repo). Kein neuer APK-Bau nötig.

Aufbau: `{ format:"tacho-design", v:1, name, aspect, orient, bg:{color,img}, els:[...] }`
Elemente haben `t` (Typ), `x y w h` in Prozent der Fläche, `rot`, `op`, `show` plus typabhängige Felder.
Typen: text, value, bar, arc, needle, dial, rect, image, sign, road, next.
Werte (`src`): speed, kmh, alt, dirname, total, trip, day, max, clock, u. a. (siehe `Design.SRC`).
Beispiele erzeugt `node tools/make-designs.js`. Bilder liegen als Data-URL in der Datei.
