# Postbox Finder 📮

**🇬🇧 English:** Find post boxes anywhere in the world – mobile-first, fast and honest about missing data.
The web app shows real post boxes from OpenStreetMap, tells you whether a box accepts international mail
(only when the data explicitly says so – never guessed from the colour), shows collection times and opens
navigation in Google Maps, Apple Maps or another map app. Free, open source, no sign-up, no API keys.
**Try it:** https://floriankml.github.io/find-postbox/ · The app is available in English and German
(automatic by browser language, switchable in the ⓘ menu).

---

**🇩🇪 Deutsch:**

Briefkästen weltweit finden – mobil, schnell, ehrlich. Die Web-App zeigt reale Briefkästen aus
OpenStreetMap auf einer Karte, erkennt (soweit belegt) ob ein Briefkasten Auslandspost annimmt, und
startet die Navigation in Google Maps, Apple Karten oder einer anderen Karten-App.

**Kosten:** 0 €. Keine API-Schlüssel nötig. Statisches Hosting (z. B. GitHub Pages) reicht.

---

## Funktionen

| Bereich | Umsetzung |
| --- | --- |
| Karte | Leaflet + OpenStreetMap-Kacheln, Touch-optimiert, Dark Mode (System/Hell/Dunkel) |
| Daten | Overpass API (`amenity=post_box`), nur für den sichtbaren Ausschnitt bzw. Umkreis |
| Standort | Browser-Geolocation **nur auf Knopfdruck** (oder automatisch, wenn früher bereits erlaubt) |
| Suche | Orte, Adressen, PLZ, Koordinaten – Photon (Vorschläge, entprellt) + Nominatim (nur bei Enter) |
| Liste | Sortiert nach Entfernung, nächster Briefkasten hervorgehoben, Umschalten Karte/Liste |
| Details | Adresse, Entfernung, Bauart, Farbe, Beschriftung, Betreiber, Leerungszeiten inkl. „nächste Leerung“, Zugang/Öffnungszeiten, Prüfdatum, Quelle, Rohdaten |
| Versand | Status *Internationaler Versand bestätigt* / *Nur nationaler Versand bestätigt* / *Versandmöglichkeiten unklar* – getrennt von der Farbe |
| Navigation | „Dorthin navigieren“ → Google Maps (Universal Link, öffnet App auf Android/iOS); Menü: Apple Karten, Android-App-Auswahl (`geo:`), OpenStreetMap (Web) |
| Filter | Umkreis 500 m / 1 / 3 / 5 km / frei, Auslandsversand, nur Inland, Betreiber, rund um die Uhr, Leerungszeiten vorhanden, kürzlich überprüft |
| Community | „Information korrigieren“, „Briefkasten fehlt/entfernt“, „Leerungszeit aktualisieren“, „Farbe/Beschriftung ergänzen“, „Internationalen Versand bestätigen“ – mit Status *Ungeprüft / Bestätigt / Widersprüchliche Angaben* (optional, Supabase) |
| Zuverlässigkeit | Kachel-Cache (Speicher + IndexedDB), Server-Fallback, Wiederholen-Button, Offline-Hinweis mit Datenstand, leere Zustände |
| PWA | Installierbar, App-Shell offline verfügbar, zuletzt geladene Briefkästen bleiben offline sichtbar (als ggf. veraltet gekennzeichnet) |
| Sprachen | Deutsch und Englisch, automatisch nach Browsersprache, umschaltbar im ⓘ-Menü (`src/i18n/`) |
| Teilen | Link-Vorschau (Open Graph / Twitter Card) mit Vorschaubild `public/og-image.jpg`, App-Icons als PNG für iOS/Android |
| Barrierefreiheit | Tastaturbedienbar (Combobox-Suche, fokussierbare Marker, Escape schließt Dialoge), sichtbarer Fokus, ausreichende Kontraste, `prefers-reduced-motion` |

## Schnellstart

Voraussetzung: Node.js ≥ 20 (getestet mit 22).

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run build      # Produktionsbuild nach dist/
npm run preview    # Build lokal ansehen
```

**Auf dem Smartphone testen:** `npm run dev -- --host` und die angezeigte LAN-Adresse öffnen.
Hinweis: Browser erlauben Geolocation nur über **HTTPS** (oder `localhost`). Im LAN funktioniert die
Suche, der Standort-Button aber erst nach dem Deployment (HTTPS) oder über einen Tunnel.

## Deployment (kostenlos)

### GitHub Pages (eingerichtet)

1. Code nach `main` pushen.
2. Repository → **Settings → Pages → Source: „GitHub Actions“**.
3. Der Workflow `.github/workflows/deploy-pages.yml` baut, testet und veröffentlicht unter
   `https://<user>.github.io/<repo>/`.

### Alternativen

Jeder statische Host funktioniert (Build-Befehl `npm run build`, Ausgabeordner `dist`):
Cloudflare Pages, Netlify, Vercel. Bei Hosting im Unterpfad `VITE_BASE=/pfad/` setzen.

### Konfiguration (alles optional) – siehe `.env.example`

| Variable | Zweck |
| --- | --- |
| `VITE_BASE` | Basis-Pfad des Deployments |
| `VITE_SITE_URL` | Absolute URL des Deployments – nötig, damit Link-Vorschaubilder funktionieren (im Pages-Workflow automatisch gesetzt) |
| `VITE_OVERPASS_ENDPOINTS` | Eigene Overpass-Server (kommagetrennt, Reihenfolge = Priorität) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Aktiviert Community-Beiträge |

Es werden **keine Geheimnisse** ins Frontend gebaut. Der Supabase-`anon`-Key ist per Design öffentlich und
durch Row-Level-Security abgesichert; den `service_role`-Key niemals verwenden.

## Community-Backend aktivieren (optional, Supabase Free Tier)

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Inhalt von [`supabase/schema.sql`](supabase/schema.sql) im SQL-Editor ausführen
   (Tabelle `postbox_reports` mit PostGIS-Standort, RLS, Rate-Limit-Trigger, Sicht `postbox_report_summary`).
3. `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen (lokal in `.env.local`, für GitHub Pages als
   Repository-*Variables*).

Ohne Backend zeigt die App die Community-Funktionen als **vorbereitete Funktion** an, speichert nichts und
verweist stattdessen auf „In OpenStreetMap bearbeiten“ bzw. eine OSM-Notiz (ohne Konto möglich).

**Validierung:** Jeder Beitrag startet als *Ungeprüft*. Nennen ≥ 2 verschiedene Geräte denselben Wert und
niemand etwas anderes → *Bestätigt*. Unterschiedliche Werte → *Widersprüchliche Angaben*. Nur bestätigte
Versandangaben ändern den angezeigten Versandstatus – und nur, wenn OSM selbst keine Angabe hat.
Spam-Schutz: Honeypot-Feld, Längenlimits, max. 20 Beiträge/Gerät/Stunde, keine Duplikate pro Tag,
Moderationsspalte (`moderation = 'hidden'`).

## Architektur

```
src/
  lib/
    types.ts            Datenmodell (Postbox, ShippingInfo, PostboxProvider …)
    osm.ts              Overpass-Abfrage, Server-Fallback, Normalisierung OSM → Postbox
    store.ts            Kachel-Cache (0,02°-Raster), IndexedDB-Persistenz, Anfrage-Bündelung
    shipping.ts         Versand-Erkennung (nur explizite Angaben) + allgemeine Betreiber-Hinweise
    collectionTimes.ts  Leerungszeiten formatieren / „nächste Leerung“
    geocode.ts          Photon / Nominatim (Rate-Limit, Cache), Koordinaten-Eingabe
    navigation.ts       Deep Links Google Maps / Apple Karten / geo: / OSM
    community.ts        Optionales Supabase-Backend (PostgREST, ohne SDK)
    filters.ts, geo.ts, labels.ts
  components/           MapView, SearchBar, FilterBar, ResultList, DetailSheet, NavigateButton, …
  i18n/                 Übersetzungen (de.ts definiert die Schlüssel, en.ts muss alle übersetzen – sonst Compile-Fehler)
  App.tsx               Layout (mobil: Vollbildkarte + Bottom-Sheet; Desktop: Seitenleiste)
supabase/schema.sql     Datenbankschema für Community-Beiträge
```

**Weitere Datenquellen:** Neue Quellen (z. B. offene Daten einer nationalen Post) implementieren das
Interface `PostboxProvider` (`fetchBBox(bbox) → Postbox[]`) und liefern eigene `source`-Kennungen.
Die Oberfläche zeigt Quelle und Evidenz pro Datensatz bereits an.

### Schonender Umgang mit den öffentlichen Diensten

- Daten werden erst ab Zoomstufe 12 und nur für den sichtbaren Bereich (bzw. Umkreis) geladen.
- Der Bereich wird in Kacheln (~2 km) zerlegt; nur fehlende Kacheln werden in **einer** Anfrage nachgeladen,
  Ergebnisse 24 h wiederverwendet (IndexedDB, bis 30 Tage als Offline-Fallback).
- Kartenbewegungen werden entprellt (450 ms), parallele Anfragen gebündelt (es läuft immer nur eine).
- GET-Anfragen ohne CORS-Preflight; bei Fehlern wird der nächste Overpass-Server versucht (2 Runden, mit Pause).
- Nominatim nur bei ausdrücklicher Suche (Enter) bzw. für eine einzelne Rückwärtssuche pro geöffnetem Briefkasten,
  max. 1 Anfrage/s, Ergebnisse gecacht – gemäß [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).
- Kartenkacheln werden **nicht** vom Service Worker vorgeladen ([Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)).

## Datenquellen & Einschränkungen

| Dienst | Nutzung | Lizenz / Bedingungen |
| --- | --- | --- |
| OpenStreetMap-Daten | Briefkästen | © OpenStreetMap-Mitwirkende, [ODbL](https://www.openstreetmap.org/copyright) – Attribution in Karte & Detailansicht |
| Overpass API (overpass-api.de, private.coffee, VK Maps) | Abfrage | Fair Use, kein garantierter Dienst |
| tile.openstreetmap.org | Kartenkacheln | [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) – für hohe Last eigenen/kommerziellen Kachelanbieter nutzen |
| Photon (komoot) | Ortssuche | Fair Use |
| Nominatim | Ortssuche/Adresse | max. 1 req/s, kein Autocomplete |

**Was man über die Daten wissen muss:**

- **Vollständigkeit schwankt stark.** In Deutschland, Großbritannien, Frankreich, Tschechien und Japan sind
  Briefkästen gut erfasst, in vielen anderen Ländern lückenhaft. Ein leerer Bereich heißt nicht, dass es dort
  keinen Briefkasten gibt.
- **Auslandsversand ist in OSM fast nie ausdrücklich erfasst.** Es gibt dafür kein etabliertes Tag. Die App
  wertet nur explizite Angaben aus (`post_box:destination`, `international`, `destination` mit erkennbarem
  Wert, Beschreibungstexte mit Postbezug). Die meisten Briefkästen stehen deshalb ehrlich auf
  *„Versandmöglichkeiten unklar“*. Allgemeine Regeln großer Postdienste (z. B. Deutsche Post, Royal Mail,
  USPS) erscheinen als separater, klar markierter **„Allgemeiner Hinweis“**, nie als Bestätigung.
- **Farbe ≠ Versandart.** Die Farbe wird nur angezeigt, wenn sie erfasst ist (`colour`), und nie zur
  Ableitung verwendet.
- **Leerungszeiten** (`collection_times`) können veraltet sein; das Prüfdatum (`check_date…`) wird angezeigt.
  „Nächste Leerung“ wird nur für einfache Formate berechnet und nutzt die Gerätezeit; Feiertage werden ignoriert.
- **Adressen** sind an Briefkästen selten erfasst. Fehlt sie, wird eine ungefähre Adresse per Nominatim ermittelt
  und als solche gekennzeichnet.
- **Keine offizielle Auskunft** der Postgesellschaften.
- Öffentliche Overpass-Server sind gelegentlich überlastet (Fehler 429/504). Die App versucht automatisch
  andere Server und zeigt sonst einen „Erneut“-Button. Für viel Traffic: eigenen Overpass-Server oder
  einen vorberechneten Datenexport (siehe nächste Schritte).

### Weitere Sprache hinzufügen

1. `src/i18n/en.ts` nach `src/i18n/<code>.ts` kopieren und übersetzen (TypeScript meldet fehlende Schlüssel).
2. In `src/i18n/index.ts` die Sprache in `Lang`, `DICTS`, `LOCALES` und `detect()` ergänzen.
3. Im Info-Dialog (`src/components/InfoDialog.tsx`) zur Auswahl hinzufügen.

Der Test `src/i18n/i18n.test.ts` prüft, dass alle Sprachen dieselben Schlüssel und Platzhalter haben.

## Datenschutz

Der Standort wird nur im Browser verwendet und nicht an eigene Server gesendet. Für Karte, Daten und Suche
spricht der Browser die genannten OSM-Dienste direkt an (dabei wird die IP-Adresse übertragen; der
Kartenausschnitt bzw. Suchbegriff ist für diese Dienste sichtbar). Es gibt kein Tracking und keine Cookies.
Community-Beiträge speichern nur Inhalt, Position und eine zufällige Geräte-ID.

## Mögliche nächste Schritte

- Vorberechneter, täglich aktualisierter Datenexport (z. B. GitHub Action → Geobuf/PMTiles auf GitHub Pages
  oder Cloudflare R2) als primäre Quelle, Overpass nur als Fallback – entlastet öffentliche Server und ist schneller.
- Captcha (Cloudflare Turnstile) über eine Supabase Edge Function für anonyme Beiträge; Moderationsansicht.
- Bestätigte Community-Daten als OSM-Notizen/Änderungsvorschläge zurückspielen.
- Weitere Betreiber-Hinweise mit Quellenangabe; nationale offene Postdaten über `PostboxProvider`.
- Marker-Clustering für sehr dichte Gebiete; Teilen-Link pro Briefkasten (`#box=…`).
- E2E-Tests (Playwright) in CI.

## Lizenz

Code: MIT. Daten: © OpenStreetMap-Mitwirkende, ODbL.
