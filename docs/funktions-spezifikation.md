# ves — Auftrags- & Zeiterfassungstool: Funktions-Spezifikation

Stand: Juni 2026. Diese Spezifikation beschreibt die bestehende
React-+-PocketBase-App vollstaendig genug, um sie auf **Flutter** (analog
zu TEKO connect) neu zu bauen. Quelle: `src/` der React-App.

> Wichtiger Gesamtbefund: Die App ist in einer **unfertigen Migration von
> Supabase zu PocketBase**. Daraus folgen zwei Baustellen, die beim
> Neubau zwingend zu vereinheitlichen sind:
> 1. **Zeiterfassung doppelt modelliert**: alte Collection `work_logs`
>    (Supabase-Erbe) vs. neue `time_entries` (Ziel). Empfehlung: nur
>    `time_entries`.
> 2. **Status-Enums gemischt** (Deutsch `Erfasst`/`In Bearbeitung` vs.
>    Englisch `open`/`in_progress`/`done`/`delivered`). Beim Neubau EIN
>    Enum festlegen.

---

## 1. Zweck & Domaene

Werkzeug fuer einen CNC-/Fertigungsbetrieb: **Auftraege erfassen**
(manuell, per PDF-Import oder Foto-Scan mit OCR), **Zeiten je Auftrag und
Arbeitsgang erfassen** (Stoppuhr oder Festwert), **Artikel- und
Arbeitsgang-Stammdaten** pflegen, **Mitarbeiter** verwalten und im
**Dashboard** den (zeitanteilig zugerechneten) Umsatz auswerten.

Mobile-first (die React-App simuliert per `DeviceFrame` ein iPhone) — fuer
Flutter ideal, weil das die native Zielform ist.

## 2. Technik-Mapping React -> Flutter

| React-App | Flutter-Pendant (Vorschlag) |
|---|---|
| React 19 + Vite | Flutter (Web + Mobile) |
| PocketBase JS-SDK | `pocketbase` Dart-Paket (wie TEKO connect) |
| Context (Order/User) | Riverpod-Provider |
| kein Router, `currentView`-State | `IndexedStack` + Enum-State, 2 Vollbild-Overrides |
| chart.js / react-chartjs-2 | `fl_chart` (Pie + Bar) |
| pdfjs-dist | `syncfusion_flutter_pdf` / `pdfrx` (Text), Viewer separat |
| tesseract.js (`'deu'`) | `google_mlkit_text_recognition` (on-device) |
| `pb.files.getUrl` | analog im Dart-SDK |
| native `alert()`/`confirm()` | SnackBar / AlertDialog |

PocketBase-URL kommt aus Env `VITE_POCKETBASE_URL` (im Flutter-Projekt per
`--dart-define=PB_URL=...`, wie bei TEKO connect).

---

## 3. Datenmodell (PocketBase-Collections)

### `orders` (Auftraege)
| Feld | Typ | Default | Bedeutung |
|---|---|---|---|
| `id` | PB-Record-ID | auto | technische ID (App-Mapping: `db_id`) |
| `order_id` | Text | — | **Auftrags-Nr.** (fachlich), Dublettenpruefung (App-Mapping: `id`) |
| `value` | Number | — | Auftragswert (EUR) |
| `date` | Date | heute | Auftragsdatum |
| `user_name` | Text | — | Klartextname des Erfassers (KEINE Relation!) (App: `user`) |
| `company` | Text | — | Kunde/Firma |
| `contact_person` | Text | — | Sachbearbeiter (nur via Import gesetzt) |
| `article_id` | Relation -> `articles` | — | verknuepfter Artikel (expandbar) |
| `quantity` | Number | — | Soll-Menge |
| `delivery_date` | Date | — | Liefertermin |
| `status` | Text(Enum) | `Erfasst`/`open` | Lebenszyklus (s.u.) |
| `original_pdf` | File | — | Original-Auftrags-PDF |
| `created` | Autodate | auto | Sortierfeld `-created` |

expand in `getOrders`: `article_id,time_entries(order_id).work_step_id`
(Back-Relation: alle Zeiteintraege des Auftrags inkl. Arbeitsgang).

### `articles` (Artikel-Stammdaten)
| Feld | Typ | Default | Pflicht |
|---|---|---|---|
| `article_id` | Text | `''` | **JA** (einziges Pflichtfeld), fachlicher Schluessel |
| `description` | Text | `''` | – |
| `unit_price` | Number | `0` | – |
| `customer_id` | Text | `''` | – (Kunde) |
| `drawing_number` | Text | `''` | – |
| `raw_material` | Text | `''` | – |
| `production_time` | Number | `0` | – (Zeit/Stueck) |
| `production_time_unit` | Text | `'s'` | – (s/m/h) |
| `work_steps` | Array<Text> | `['Büro','Einrichtung','Fertigung','Lieferung']` | – (Namen, lose Kopplung) |
| `image` | File | – | Bild |
| `drawing` | File | – | Fertigungs-PDF |
| `customer_drawing` | File | – | Kundenzeichnung-PDF |

Datei-Limit 5 MB/Datei (clientseitig). Auftrag<->Artikel koppeln ueber
`article_id` (Nummer), nicht ueber die Record-ID.

### `time_entries` (Zeiterfassung — ZIELMODELL)
| Feld | Typ | Default | Bedeutung |
|---|---|---|---|
| `id` | PB-Record-ID | auto | = laufende Session-ID |
| `order_id` | Relation -> `orders` | — | speichert Record-ID des Auftrags |
| `staff_id` | Relation -> `staff` | — | eingeloggter Mitarbeiter |
| `work_step_id` | Relation -> `work_steps` | null | nur wenn echter DB-Schritt (ID > 10 Z.) |
| `type` | Text(Enum) | — | `Stoppuhr` oder `Festwert` |
| `status` | Text(Enum) | — | `In Bearbeitung` -> `Abgeschlossen` |
| `start_time` | DateTime(ISO) | — | Start |
| `end_time` | DateTime(ISO) | — | Ende |
| `duration_minutes` | Number | — | Dauer (Min, Stoppuhr aufgerundet) |
| `quantity` | Number | null | produzierte Menge (nur Fertigung) |
| `notes` | Text | `''` | Bemerkung |

### `work_logs` (ALTLAST — Supabase-Erbe, beim Neubau weglassen)
Aehnliche Semantik wie `time_entries`, andere Feldnamen
(`user_name`, `quantity_produced`, `pause_time_minutes`, `task_type`,
`mode`). Einige UI-Teile (Dashboard, OrderList-History) lesen noch
`work_logs`. Beim Neubau auf `time_entries` konsolidieren bzw. einmalig
migrieren.

### `work_steps` (Arbeitsgang-Stammdaten)
Zweifache Realitaet:
- Als **PocketBase-Collection** (Relation-Ziel von `time_entries`): Felder
  u.a. `id`, `name`, `parent_id`, `is_group`, `default_minutes`, `icon`,
  `color`, `category`, `created`.
- Als **Setting-Blob** `work_steps_config` (Key/Value, s.u.) — die
  Verwaltungs-UI (`WorkStepsManagement`) speichert den ganzen Baum als
  JSON dort, NICHT in der Collection. Beim Neubau: EIN Speicherort
  festlegen (Collection bevorzugt).

Baum: Gruppen (`type:'group'`, nur Top-Level, mit `children`) + Schritte
(`type:'step'`). Schritt hat `icon` (17 feste Icons), `color` (12 feste
Farben), `selectedMode` und `modeSettings` (pro Modus: `minutes` + Einheit
s/m/h). Modi: Standard `manual`/`stopwatch`; Spezialfall Lieferung
(`delivery_company`, `delivery_employee`, `pickup_employee`, `stopwatch`).
Default-Baum: Gruppe "Administration" (Angebot/Auftragsbestaetigung/
Auftrag/Lieferschein) + Vorbereitung + Fertigung + Lieferung.

### `staff` (Mitarbeiter = Auth-Collection)
| Feld | Typ | Default | Bedeutung |
|---|---|---|---|
| `id` | PB-Record-ID | auto | = `staff_id` |
| `firstname` / `lastname` | Text | — | Name (synthetisch `name = "Vor Nach"`) |
| `color` | Text(Hex) | `#3b82f6` | UI-Farbe |
| `avatar_id` | Text | `'1'` | 1..8, Index in festem Avatar-Pool |
| Auth-Felder | — | — | E-Mail/Passwort (Auth-Collection) |

Kopplung: `orders.user_name` ist Klartext = `staff.name`. Umbenennen
aktualisiert alle Orders; Loeschen kaskadiert (erst Orders, dann staff).
**Flutter-Empfehlung: echte Relation `staff_id` am Auftrag statt
Klartextname.**

### `settings` (Key/Value)
`key` (Text, eindeutig) + `value` (JSON-String). Upsert ueber `key`.
Genutzt fuer `work_steps_config`.

---

## 4. Module / Funktionen

### 4.1 App-Shell & Navigation
- **Kein URL-Routing**; ein State `currentView` steuert alles. Werte:
  `dashboard` (Default), `orders`, `articles`, `users`, `settings`,
  `work-steps`, `add-manual`.
- **Drei Render-Zustaende** (Reihenfolge): (1) nicht eingeloggt ->
  nur `LoginScreen`; (2) aktive Session -> nur `ActiveSessionPage`
  (Vollbild-Timer, verdraengt Shell+Nav); (3) Normalfall -> Shell.
- **Shell**: Header (nur Logo), Main = aktive View, **Bottom-Nav (5)**:
  Home(dashboard) · Plus(zentral, oeffnet AddOrderModal) · FileText(orders)
  · Package(articles) · Settings(settings, highlightet auch bei users).
  `GlobalTimer` ist permanent in der Shell eingebettet.
- **DeviceFrame** = reines Web-Desktop-iPhone-Mockup (PC/Smartphone-
  Toggle). Beim nativen Flutter-Rebuild **ersatzlos weglassen**.

### 4.2 Login / Auth
- `LoginScreen`: Felder "Benutzername oder Email" + "Passwort", Button
  "Anmelden". Fehler -> "Anmeldung fehlgeschlagen...".
- `login(identity, password)`: erst `staff.authWithPassword`, bei Fehler
  `admins.authWithPassword`. Erfolg flippt `isAuthenticated` -> Shell.
- `isAdmin` = `authStore.isSuperuser`. `currentUser` zusaetzlich in
  localStorage gespiegelt (Auto-Select erster Mitarbeiter im "simple
  mode" ohne erzwungene Auth).
- **Kein sichtbarer Logout** im Login/Header — beim Neubau in Settings
  ergaenzen (`authStore.clear()`).

### 4.3 Auftraege (Kernmodul)
- **OrderList ("Auftrags-Cockpit")**: Karten-Grid (kein Tabellen-Layout).
  Pro Karte: Artikelbild, Auftrags-Nr., Status-Punkt+Label, Firma,
  Artikelname, Wert-Pill `x.xx €`, Mengen-Pill, Lieferdatum, Buttons
  "Original" (PDF) + Artikel-Info, einklappbare **Arbeitsgang-Historie**
  (Zeiteintraege inkl. Inline-Edit der Minuten + Loeschen).
  - Suche ueber `order_id` + `user`. Sortierung fix nach Datum absteigend.
    Keine weiteren Filter.
  - Inline-Edit pro Karte: `company`, `quantity`, `value`,
    `delivery_date`. Loeschen mit Bestaetigungsdialog.
  - Status-Button oeffnet `WorkSessionModal` (Zeiterfassung starten).
  - **CSV-Export** der gefilterten Liste (`;`-separiert, de-DE).
- **Auftrag anlegen** ueber `AddOrderModal` (Bottom-Sheet) mit 3 Wegen:
  **Scannen** -> ScanOrderModal, **PDF-Import** -> ImportOrderModal,
  **Manuell** -> `OrderForm`.
  - `OrderForm` Pflichtfelder: Auftrags-Nr. (`id`), Wert (`value`),
    Benutzer (`user`). Optional: Firma, Menge (Freitext), Datum,
    Lieferdatum.
- **OrderDetailsModal**: zwei Views.
  - `overview`: Fortschritts-Bar (`Σ produzierte Menge / Soll`),
    Artikel-Info (Bild/Zeichnung oeffnen), Arbeitsgang-Liste mit
    Inline-Edit + **Mengen-Split** (reduzierte Menge einem anderen
    Mitarbeiter gutschreiben).
  - `process` (3 Schritte): Arbeitsgang waehlen -> Modus (Standard=
    Pauschalzeit aus Artikel / Zeitaufnahme=Stoppuhr) -> Stoppuhr +
    Mengen-Slider -> "Vorgang abschliessen & Speichern".
- **Status-Lebenszyklus** (Zielenum, vereinheitlicht):
  `open (Offen)` -> `in_progress (In Bearbeitung)` -> `done (Gefertigt)`
  -> `delivered (Ausgeliefert)`. Farben: Amber/Blau/Violett/Emerald.
  Auftragsstatus und Arbeitsgang-Typ (Buero/Einrichtung/Fertigung/
  Lieferung) sind GETRENNTE Konzepte mit eigenen Farben.

### 4.4 Import & Scan
- **PDF-Import (ImportOrderModal)**: Datei -> `extractTextFromPdf`
  (pdfjs, nur eingebetteter Text, KEIN OCR-Fallback) ->
  `parsePositionsFromText` -> Staging-Liste editierbarer Positionen ->
  optional fehlende Artikel anlegen -> `saveOrders(..., pdfFile)`.
- **Foto-Scan (ScanOrderModal)**: Kamera/Bilder (mehrseitig) ->
  `analyzeImage` (Tesseract `'deu'`, Progress) -> Rohtext ->
  **derselbe** Import-Dialog (`initialText`).
- **Parser**: stark auf ein Lieferantenformat ("Johannes Huebner")
  zugeschnitten (Positionsmuster `NN ID: digits`, `KT-`-Zeichnungsnr.,
  deutsche Zahlen `1.234,56`, Datum `TT.MM.JJJJ`). Erkennt: Auftrags-Nr.,
  Datum, Firma, Sachbearbeiter, je Position Menge/Preis/Beschreibung/
  Artikel-Nr./Zeichnungsnr./Rohmaterial/Liefertermin.
- **Wichtig:** `description`, `drawing_number`, `raw_material` landen
  aktuell NUR am Artikel, NICHT am Auftrag. Beim Neubau entscheiden, ob
  sie am Auftrag persistiert werden sollen.
- **Flutter-Empfehlung:** EIN regelbasierter, testbarer Parser mit
  Lieferanten-Profilen statt hartkodierter Eigennamen; zentrale
  Normalisierung fuer deutsche Zahlen/Daten; ML-Kit-OCR; OCR-Fallback
  fuer Bild-PDFs.

### 4.5 Zeiterfassung
- **Konzept**: Hierarchie Auftrag -> Arbeitsgang (work_step) ->
  Zeiteintrag (time_entry). Genau EINE laufende **Session** je
  Mitarbeiter (Singleton, in localStorage `ves_active_session` +
  als `time_entries`-Record mit `status:'In Bearbeitung'`).
- **Timer** rein clientseitig aus `start_time` (`elapsed = now - start`),
  ueberlebt Reload (Start-Timestamp persistiert). **Pause** (nur
  ActiveSessionPage) ist lokaler State und NICHT reload-fest -> beim
  Neubau Pausenzeit persistieren. Dauer beim Stop auf volle Minuten
  aufgerundet (`ceil`).
- **WorkSessionModal**: Arbeitsgang aus dem Baum waehlen, dann Modus
  Stoppuhr (`startSession`) oder Festwert (`commitSessionToOrder` legt
  sofort fertigen Eintrag mit Pauschalzeit an).
- **Abschluss**: Menge (nur bei Fertigung, Slider mit Rest-Begrenzung) +
  Notiz; setzt Auftragsstatus je Arbeitsgang-Kategorie (Fertigung->done,
  Lieferung->delivered).
- **Keine echte Auswertungsseite** vorhanden — Datenbasis fuer Reports
  ist `time_entries` (Dauer/Menge/Schritt/Mitarbeiter). Beim Neubau eine
  echte Zeit-Auswertung (Summen, Filter, Perioden) ergaenzen.

### 4.6 Stammdaten & Verwaltung
- **ArticleList/-Details**: Karten-Grid mit Suche (article_id/
  description/customer_id), Inline-Create/Edit (FormData inkl. 3
  Datei-Slots), Detail-Modal (read-only, PDF-iframes + Spec-Tabelle).
  Detail matcht ueber Artikelnummer clientseitig (Text/Number-Workaround).
- **WorkStepsManagement ("Arbeitsgaenge")**: Baum-Editor mit Gruppen
  ("Ordner", 1 Ebene) + Schritten, Drag&Drop (inkl. Hover-to-open in
  Gruppe), Icon/Farbe/Modus/Zeit pro Schritt, Reset auf Default, expliz.
  "Speichern" (dirty-state, kein Auto-Save). Persistenz als JSON unter
  Setting `work_steps_config`.
- **UserManagement**: Mitarbeiter (Vorname/Nachname Pflicht, Farbe,
  Avatar 1-8 aus festem Pool). Nur `isAdmin` darf schreiben; sonst "Nur
  Lesen". Loeschen kaskadiert ("...und ALLE zugehoerigen Daten").
  Logout-Button hier. Identitaet im UI ueber `name` (besser: Record-ID).
- **Settings**: reine Menue-Seite -> Benutzerverwaltung / Arbeitsgaenge.

### 4.7 Dashboard (Kern-Geschaeftslogik)
- Jahres-Filter (`selectedYear`, aus `delivery_date`/`date`).
- **Umsatz-Zurechnung (exakt portieren!)**: pro Auftrag wird `value`
  **zeitanteilig** auf Mitarbeiter verteilt nach `duration_minutes` der
  zugehoerigen Zeiteintraege; ohne Zeiteintraege faellt der volle Wert an
  den Ersteller (`order.user`, sonst "nicht zugeordnet").
- Kacheln: **Uebersicht** (Jahresumsatz + Vergleichstext "X liegt mit Y €
  vorne"/"Gleichstand!"/"Noch keine Umsaetze"), **Pie** (Verteilung pro
  Mitarbeiter, Segmentfarbe = `staff.color`), **Bar** (Auftragsanzahl
  letzte 5 Jahre).

### 4.8 Geteilte Bausteine
- **ConfirmationModal** (generisch: title/message/confirm/cancel/
  isDestructive) — fuer alle Loesch-Bestaetigungen wiederverwenden
  (Flutter: zentraler `AlertDialog`-Wrapper).
- **ErrorBoundary** (aktuell ungenutzt) -> in Flutter globaler
  Error-Handler + Fallback-Widget.
- Realtime: `pb.collection('orders').subscribe('*')` und
  `staff.subscribe('*')` loesen jeweils ein Voll-Neuladen aus.

---

## 5. Bekannte Inkonsistenzen / Altlasten (vor/bei Neubau klaeren)
1. `work_logs` vs. `time_entries` — auf `time_entries` konsolidieren.
2. Status-Enum DE vs. EN — ein Enum.
3. `orders.user_name` Klartext statt Relation — auf `staff_id` umstellen.
4. `work_steps` doppelt (Collection vs. `work_steps_config`-Setting) —
   einen Speicherort waehlen.
5. Import-Parser hartkodiert auf einen Lieferanten — generalisieren.
6. Import-Felder `description`/`drawing_number`/`raw_material` gehen am
   Auftrag verloren — Persistenz entscheiden.
7. Pausenzeit nicht reload-fest — persistieren.
8. Debug-Reste in OrderList (`alert("Button Clicked...")`, toter
   `handleStatusCycle`) — nicht uebernehmen.
9. Englische Fehlermeldungen/`alert()` — durch DE-SnackBars ersetzen.
10. Keine echte Zeit-Auswertungsseite — neu spezifizieren.

---

## 6. Empfohlene Flutter-Architektur (analog TEKO connect)
- `lib/models/` (Order, Article, TimeEntry, WorkStep, Staff, AppSetting)
- `lib/services/` (PocketBaseService, PdfService, OcrService, ImportParser)
- `lib/providers/` (Riverpod: authProvider, orderProvider, articleProvider,
  workStepProvider, activeSessionProvider, settingsProvider)
- `lib/ui/` (Shell mit Bottom-Nav, Seiten je Modul, geteilte Dialoge)
- Backend PocketBase ueber `--dart-define=PB_URL=...`.
- Charts via `fl_chart`, OCR via ML Kit, PDF via syncfusion/pdfrx.
