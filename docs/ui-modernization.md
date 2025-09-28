# UI Modernization Plan (App Router)

Datum: 2025-09-28

## Scope & Constraints

- **Ziel**: Modernes, konsistentes UI-Design. Alle Funktionen/Flows bleiben unverändert.
- **Keine Logikänderungen**: Nur Darstellung (Markup/CSS), keine API- oder State-Änderungen.
- **Externe CSS**: Styles ausschließlich in externen CSS-Dateien, keine Inline- oder JS-Styles.
- **Kein neues Package**: Keine lokalen Installationen, Umgebung läuft meist in Docker.
- **API-Konstanten**: Alle Client-APIs bleiben zentral in `src/constants/apiPaths.ts` referenziert.
- **Bestandsschutz**: Komponenten/Seiten, Endpunkte, Redux-Slices, Selektoren bleiben erhalten.

## Ist-Analyse (Kurz)

- **Uneinheitlicher Look**: Utility-Klassen direkt im JSX, unterschiedliche Abstände/Typografie, kein konsistentes Farb-/Spacing-System.
- **Loader/Fehler uneinheitlich**: Unterschiedliche Spinner/Alerts, teils nur Textausgaben.
- **Bedienbarkeit**: Fokus-/Hover-Zustände nicht überall konsistent, ARIA uneinheitlich.
- **Dark/Light**: Kein klares Theme-Switch/Auto-Theme (prefers-color-scheme), Kontraste variieren.

Betroffene Komponenten/Seiten:
- `src/components/ConfigData.tsx`
- `src/components/EtaData.tsx`
- `src/components/ZeitfensterTab.tsx`
- `src/components/HeizkreisTab.tsx`
- `src/components/WifiTab.tsx`, `src/components/WifiAf83Data.tsx`
- `src/components/HeaderWithMenu.tsx`, `src/components/MenuPopup.tsx`
- `src/app/weather/page.tsx`, `src/app/logs/page.tsx`

## Designsystem (neu, CSS-only)

- **Design Tokens** als CSS-Variablen: Farben, Spacing, Radius, Schatten, Typografie.
  - Datei: `src/styles/tokens.css`
- **Theme** (Light/Dark): globale Farbausprägungen per `prefers-color-scheme` + optionaler manueller Toggle.
  - Datei: `src/styles/theme.css`
- **Komponenten-CSS** (BEM-orientiert, schlank):
  - Buttons: `src/styles/components/button.css`
  - Karten: `src/styles/components/card.css`
  - Switches: `src/styles/components/switch.css`
  - Inputs: `src/styles/components/input.css`
  - Badges/Alerts: `src/styles/components/badge.css`
  - Progress: `src/styles/components/progress.css`
  - Skeleton/Loader: `src/styles/components/skeleton.css`
- **Global Import**: `src/app/globals.css` importiert Tokens/Theme/Komponenten-CSS.

Beispiel Tokens (Auszug):
```css
:root {
  --color-bg: #0b1020;
  --color-surface: #11162a;
  --color-text: #e6e8ef;
  --color-primary: #4c8bf5;
  --color-success: #30c48d;
  --color-warning: #f5b54c;
  --color-danger: #ef5350;
  --radius: 10px;
  --shadow: 0 8px 30px rgba(0,0,0,0.25);
  --space-1: 6px; --space-2: 10px; --space-3: 16px; --space-4: 24px;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: light) {
  :root { --color-bg: #f7f9fc; --color-surface: #ffffff; --color-text: #1c2430; }
}
```

## Komponenten – Modernisierung ohne Logikänderung

- **Header/Navi (`HeaderWithMenu.tsx`)**
  - Sticky Topbar, aktive Route visuell, Mobile-Menü (Burger → Drawer), `.btn .btn--ghost` für Tabs.
- **ConfigData (`ConfigData.tsx`)**
  - Layout als `.card` mit Header/Body.
  - Eingabefelder: `.input` mit Einheiten-Suffix (°C, min), Steppers, Validierungs-Hinweise.
  - „Empfohlene Schieber Position“: `.progress` + `.progress__bar` (Breite in %), Prozentzahl daneben.
  - Statushinweise: `.badge badge--info/warn` und konsistente `.spinner` beim Laden.
- **EtaData (`EtaData.tsx`)**
  - Werte in `.card`-Grid, Status als `.badge` (neutral/ok/warn), Monospace für Zahlen.
  - Heiz-Tasten als `.switch` (`role="switch"`, `aria-checked`).
  - „Manual override aktiv – Restzeit“ als `.alert alert--warning`, Button „Override beenden“ als `.btn`.
- **ZeitfensterTab (`ZeitfensterTab.tsx`)**
  - Tabellen in `.card` mit sticky Header, Eingaben mit `.input`, Save/Reset in `.card__footer`.
- **HeizkreisTab (`HeizkreisTab.tsx`)** (read-only)
  - Zweispaltiges Layout in `.card`, Werte mit `.badge` + Einheit.
- **Weather/Logs (`/app/weather/page.tsx`, `/app/logs/page.tsx`)**
  - Weather: Karten für innen/außen, Trend-Pfeile (SVG), „Letzte Aktualisierung“ als `.badge`.
  - Logs: Tabelle mit sticky Header, Filterleiste (Datum/Kategorie), Copy-Icon (SVG), farbige Level-Badges.

## Accessibility & UX

- **Fokus/Keyboard**: klare Fokus-Ringe, Tab-Reihenfolge, Enter/Space auf Switches.
- **ARIA**: `aria-live` für dynamische Hinweise (z.B. Empfehlung), `aria-current="page"` für aktive Tabs.
- **Tooltips**: native `title` oder CSS-basiert für kritische Controls.

## Loading/Fehlerzustände

- **Loader**: Ein konsistenter Spinner + Skeleton (erste Ladephase) pro card.
- **Fehler**: `.alert alert--error` mit ggf. Retry-Button (`.btn .btn--ghost`).

## CSS-Struktur

- Ordner: `src/styles/`
  - `tokens.css`, `theme.css`, `components/*.css`
- Import-Reihenfolge in `globals.css`: Tokens → Theme → Components → Overrides (falls nötig)
- Keine Änderungen an Business-Logik oder API-Aufrufen. API-URLs bleiben über `API.*`-Konstanten.

## Roadmap (ToDo, priorisiert)

- **[Hoch]** Design Tokens + Theme + Komponenten-CSS anlegen
- **[Hoch]** ConfigData optisch modernisieren (Form UI, Progressbar)
- **[Hoch]** EtaData Switches/Badges/Override-Alert optisch modernisieren
- **[Mittel]** Header/Navi (responsive, sticky, aktiv)
- **[Mittel]** ZeitfensterTab & HeizkreisTab (Cards/Tables)
- **[Mittel]** Einheitliche Loader/Skeletons
- **[Mittel]** Accessibility-Feinschliff (ARIA, Fokus)
- **[Niedrig]** Weather/Logs Polishing (Filter/Sticky-Header)

## Akzeptanzkriterien

- Keine Funktionsregressionen (alle Buttons/Flows/API-Calls unverändert, inkl. `API.*`).
- Dark/Light funktionieren; Kontraste AA mindestens.
- Einheitliche Buttons, Cards, Switches, Inputs, Badges, Alerts, Progress, Loader.
- Accessibility: Fokus sichtbar, Switch bedienbar per Tastatur, ARIA korrekt.

## Testplan (manuell)

- **Config**: Soll/Delta/Min ändern, Speichern, Live-Empfehlung aktualisiert, Validierungsfehler sichtbar.
- **ETA**: Alle Heiz-Tasten schalten, Override läuft/endet, AA setzt zurück, UI synchron.
- **Zeitfenster**: Änderungen speichern (via `API.ETA_UPDATE`), Layout bleibt lesbar/responsiv.
- **Weather/Logs**: Daten laden, Filter anwenden (Logs), keine Layoutsprünge.
- **Mobile**: Navigation/Drawer, Karten-Layouts, Scroll/Sticky-Header.

## Risiken & Abmilderung

- **Regressionsrisiko**: Schrittweise Styles einführen, pro Komponente reviewen.
- **Kontrast/Lesbarkeit**: Token-basierte Anpassung, Live-Checks (Dark/Light).
- **A11y**: Vorab-Checkliste, Screenreader-Schnelltest.

## Umsetzungshinweise

- Start mit `src/styles/`-Struktur und `globals.css`-Imports.
- Komponenten sukzessive von Utility-Explosion auf kompakte Klassen migrieren.
- Keine Änderungen an Redux/Thunk/Effects/Servercode nötig.
- PRs pro Komponente/Seite, visuelle Diffs/Schirmfotos im Review.
