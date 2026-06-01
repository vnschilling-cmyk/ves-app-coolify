# ves — Auftrags- & Zeiterfassungstool

Diese Datei liegt im Repo und wird von Claude Code automatisch geladen.
Maschinenunabhaengige Wissensbasis. Geheimnisse (PB-URL/Creds, Keys)
stehen hier NICHT drin. Antworten, Commits und Code-Kommentare auf
**Deutsch** (Kommentare ohne Umlaute: ae/oe/ue/ss, keine Emojis).

## Was ist das?

Web-App zur **Auftrags- und Zeiterfassung** der ves. Auftraege erfassen
(manuell, per PDF-Import oder Foto-Scan/OCR), Arbeitsschritte und
Zeiten pro Auftrag tracken, Artikel verwalten, Auswertung per Charts.

## Stack

- **React 19 + Vite 7** (reines JavaScript, KEIN TypeScript). SPA.
- **Backend: PocketBase** (JS-SDK `pocketbase`), URL aus Env
  `VITE_POCKETBASE_URL` (`src/lib/pocketbase.js`).
- **State:** React Context (kein Redux). `src/context/OrderContext.jsx`
  (Auftraege + aktive Session), `src/context/UserContext.jsx` (Auth/User).
- **UI:** lucide-react Icons, eigenes `DeviceFrame` (mobile-aehnlicher
  Rahmen), CSS pro Komponente. Charts via chart.js / react-chartjs-2.
- **Import/Scan:** `pdfService.js` (pdfjs-dist, Text aus PDF),
  `ocrService.js` (tesseract.js, OCR deutsch), file-saver fuer Export.

## Setup (neuer Rechner)

```bash
git clone https://github.com/vnschilling-cmyk/ves-app-coolify.git
cd ves-app-coolify
npm install
# .env anlegen (NICHT im Repo) mit der PocketBase-URL:
#   VITE_POCKETBASE_URL=https://<deine-pocketbase>...
npm run dev        # Vite Dev-Server (--host, im Browser oeffnen)
```
Weitere Scripts: `npm run build`, `npm run preview`, `npm run lint`.
Hinweis: `preinstall.js` laeuft automatisch vor `npm install`.

## Architektur (Kurz)

- `src/main.jsx` -> `src/App.jsx` (Entry). App rendert in `DeviceFrame`,
  umschlossen von `OrderProvider` + `UserProvider`. View-Wechsel ueber
  lokalen State `currentView` (dashboard/orders/users/settings/
  work-steps/add-manual/...), kein Router.
- `src/services/storage.js` — alle PocketBase-Zugriffe (CRUD) gebuendelt.
  Mappt DB-Spalten auf App-Modell (z.B. `order_id`=Auftrags-Nr,
  `db_id`=PB-Record-ID).
- `src/components/` — Seiten + Modals (Dashboard, OrderList/Form,
  TimeTracking, WorkStepsManagement, UserManagement, Settings,
  Scan/Import-Order-Modals, ActiveSessionPage, GlobalTimer, ...).

## PocketBase-Collections (aus dem Code referenziert)

`orders`, `articles`, `time_entries`, `work_logs`, `work_steps`,
`staff`, `settings`.
- `orders`: order_id (Auftrags-Nr), value, date, user_name, company,
  quantity, delivery_date, status (Default 'Erfasst'), original_pdf.
  Relationen via `expand`: article_id, time_entries(order_id).work_step_id.

## Hinweise / Altlasten

- `fix_rls.sql`, `update_schema_time_tracking.sql` stammen aus einer
  frueheren **Supabase**-Phase (RLS = Row Level Security). Aktiv ist
  jetzt PocketBase - die SQL-Dateien sind nicht mehr Teil des Backends.
- `test-db.js/.cjs`, `debug_icons.js`, `test_lucide.js`, `test_pdfjs.js`
  sind Debug-/Test-Skripte im Root.
- README.md ist noch das Vite-Default-Template (nicht projektspezifisch).
- `.env` ist nicht im Repo - die PocketBase-URL muss lokal gesetzt werden.

## Konventionen

- Deutsch in Antworten/Commits/Kommentaren. Kommentare ohne Umlaute,
  keine Emojis. Vor Commit: `npm run lint` (eslint) auf saubere Aenderung.
- Commits mehrzeilig, erklaeren WARUM. Letzte Zeile:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
