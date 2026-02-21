# GeoQuiz — Full Technical Specification

**Version:** 2.0 · February 2026  
**Stack:** React / TypeScript / @dnd-kit / react-simple-maps  
**Status:** Ready for implementation

> Standalone app. Separate codebase from the vocab SRS app, but shares conventions, the SM-2 algorithm, and IndexedDB patterns.

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Technology Stack](#2-technology-stack)
3. [Geographic Data Sources](#3-geographic-data-sources)
4. [Data Model & TypeScript Interfaces](#4-data-model--typescript-interfaces)
5. [Component Architecture](#5-component-architecture)
6. [Quiz Mode Specifications](#6-quiz-mode-specifications)
7. [Spaced Repetition System](#7-spaced-repetition-system)
8. [Label Formatting Rules](#8-label-formatting-rules)
9. [Map Rendering Details](#9-map-rendering-details)
10. [@dnd-kit Configuration](#10-dnd-kit-configuration)
11. [State Management (Zustand)](#11-state-management-zustand)
12. [IndexedDB Schema](#12-indexeddb-schema)
13. [Routing & Screen Flow](#13-routing--screen-flow)
14. [Territory Policy](#14-territory-policy)
15. [V2 Candidates](#15-v2-candidates)
16. [Suggested Implementation Order](#16-suggested-implementation-order)

---

## 1. Overview & Goals

GeoQuiz teaches and reviews geographic knowledge organized into four **focuses**. Each focus pools together regions, capitals, and major cities into a single mixed quiz queue. Two quiz modes are available: **Type/Select** and **Drag-and-Drop**.

### The Four Focuses

| Focus | Regions | Capitals | Major Cities |
|---|---|---|---|
| **US** | 50 states + DC | State capitals | Major US cities |
| **World** | All countries | National capitals | — |
| **China** | 34 provincial-level units | Provincial capitals | Major Chinese cities |
| **Europe** | All European countries | National capitals | Major European cities |

> Capitals and cities are **mixed into the same pool** as regions — no separate quiz types. A session may present any mix of region polygons, capital point targets, and city point targets drawn from the same SRS queue.

### Session Modes

- **Single Focus (Learn + Review):** select one focus; new items and due SRS cards from that focus only
- **Review All (Review only):** draws due SRS cards from all four focuses combined; no new item introduction

### Design Principles

- **Learner agency:** choose focus, quiz mode, and session size (10 items or full set)
- **SRS-driven review:** every geographic item (region, capital, or city) has an SM-2 card
- **Bilingual labels:** Chinese items display as `English (汉字)` — no pinyin in the UI
- **Accessible interaction:** keyboard nav for type/select; keyboard snap shortcut in drag-drop; touch-friendly
- **Offline-first:** all data and progress stored in IndexedDB; no backend required
- **Simple territory policy:** disputed territories are included under the most widely accepted jurisdiction — no special flags or settings

---

## 2. Technology Stack

| Package | Version | Role |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | latest | Build tool; fast HMR |
| react-simple-maps | ^3 | SVG vector map rendering via D3-geo |
| @dnd-kit/core + @dnd-kit/utilities | latest | Drag-and-drop engine; accessible, touch-capable |
| idb | ^8 | IndexedDB wrapper for SRS card persistence |
| Zustand | ^4 | Lightweight global state |
| Fuse.js | ^7 | Fuzzy-match typed answers against item names |
| Tailwind CSS | ^3 | Utility styling |
| React Router | v6 | Client-side routing |
| Vitest + Testing Library | latest | Unit and integration tests |

---

## 3. Geographic Data Sources

All map data is bundled as static GeoJSON/TopoJSON files. No runtime API calls needed. Capitals and cities are stored as point-feature GeoJSON separate from polygon region data.

### 3.1 Region Polygons

| Focus | Source | File | Notes |
|---|---|---|---|
| US states | US Census TIGER (20m cartographic boundary) | `us-states.json` | Properties: `NAME`, `STUSPS`, `GEOID` |
| World countries | Natural Earth 110m | `world-countries.json` | Properties: `NAME`, `ISO_A2`, `ISO_A3`, `CONTINENT` |
| China provinces | GADM Level 1 for China | `china-provinces.json` | 34 features; add `NAME_ZH` (汉字) via manual pass |
| Europe countries | Natural Earth 110m filtered by continent | `europe-countries.json` | Subset of world-countries; Kosovo included as independent |

### 3.2 Point Features (Capitals & Cities)

| Focus | File | Filter | Notes |
|---|---|---|---|
| US capitals + cities | `us-points.json` | State capitals + cities with pop ≥ 100,000 | Properties: `NAME`, `IS_CAPITAL`, `STATE_CODE`, `POP` |
| World capitals | `world-capitals.json` | `IS_CAPITAL = true` only | Properties: `NAME`, `ISO_A3`, `IS_CAPITAL` |
| China capitals + cities | `china-points.json` | Provincial capitals + cities with pop ≥ 500,000 | Properties: `NAME`, `NAME_ZH`, `IS_CAPITAL`, `PROVINCE_ID`, `POP` |
| Europe capitals + cities | `europe-points.json` | National capitals + cities with pop ≥ 500,000 | Properties: `NAME`, `ISO_A3`, `IS_CAPITAL`, `POP` |

> **Data prep note:** `NAME_ZH` for all China features (provinces, capitals, cities) requires a manual verification pass. Source data is unreliable for this field.

---

## 4. Data Model & TypeScript Interfaces

### 4.1 Core Types

```ts
type Focus = 'us' | 'world' | 'china' | 'europe';

type ItemType = 'region' | 'capital' | 'city';
```

### 4.2 GeoItem (unified item model)

All quizzable items — regions, capitals, and cities — share a single interface. Regions are polygon features; capitals and cities are point features.

```ts
interface GeoItem {
  id: string;                       // e.g. "us-region-CA", "china-capital-beijing", "europe-city-milan"
  focus: Focus;
  itemType: ItemType;
  nameEn: string;                   // English canonical name
  nameLocal?: string;               // 汉字 for China focus items only
  aliases: string[];                // alternate spellings for fuzzy match (may include pinyin for CN)
  coordinates?: [number, number];   // [lng, lat] — required for capitals and cities; omitted for regions
  parentRegionId?: string;          // for capitals/cities: the region they belong to (e.g. "china-region-GD")
  isCapital: boolean;
}
```

### 4.3 GeoCard (IndexedDB — SRS)

```ts
interface GeoCard {
  id: string;             // matches GeoItem.id
  focus: Focus;
  itemType: ItemType;
  easeFactor: number;     // SM-2 EF, initialized at 2.5
  interval: number;       // days until next review
  repetitions: number;
  nextReview: number;     // Unix timestamp (ms)
  totalReviews: number;
  correctStreak: number;
  lastSeen: number;       // Unix timestamp (ms)
}
```

### 4.4 QuizSession & QuizResult

```ts
type SessionScope = Focus | 'all';

interface QuizSession {
  id: string;
  startedAt: number;
  scope: SessionScope;              // which focus, or 'all' for Review All
  mode: 'type_select' | 'drag_drop';
  sessionSize: 10 | 'all';
  queue: string[];                  // ordered GeoItem ids
  results: QuizResult[];
  completed: boolean;
}

interface QuizResult {
  itemId: string;
  correct: boolean;
  responseTimeMs: number;
  attempt: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5;  // SM-2 quality score
}
```

### 4.5 AppSettings

```ts
interface AppSettings {
  progressView: 'map' | 'list';     // persisted dashboard toggle state
}
```

---

## 5. Component Architecture

```
src/
├── main.tsx
├── App.tsx                          # Router root
│
├── components/
│   ├── maps/
│   │   ├── USMap.tsx                # AlbersUSA projection; state polygons
│   │   ├── WorldMap.tsx             # Natural Earth projection; country polygons
│   │   ├── ChinaMap.tsx             # Mercator ~105°E; province polygons; bilingual tooltips
│   │   ├── EuropeMap.tsx            # Mercator ~15°E; country polygons
│   │   ├── PointLayer.tsx           # SVG circle overlay for capitals + cities on any base map
│   │   ├── RegionHighlight.tsx      # Pulsing fill animation for active region target
│   │   └── MapContainer.tsx         # Auto-zoom logic, focus-appropriate base map switcher
│   │
│   ├── quiz/
│   │   ├── QuizController.tsx       # Session orchestration: queue, scoring, SRS update
│   │   ├── TypeSelectQuiz.tsx       # Text input + dropdown fallback
│   │   ├── DragDropQuiz.tsx         # @dnd-kit canvas; label pool + map targets
│   │   ├── LabelPool.tsx            # Draggable chips + keyboard snap input
│   │   ├── DropTarget.tsx           # Per-item droppable zone
│   │   ├── FeedbackOverlay.tsx      # Correct/incorrect flash + reveal
│   │   └── SessionSummary.tsx       # End-of-session stats + SRS preview
│   │
│   ├── progress/
│   │   ├── ProgressDashboard.tsx    # Container: focus tabs + map/list toggle
│   │   ├── ProgressMapView.tsx      # Choropleth heatmap by mastery level
│   │   └── ProgressListView.tsx     # Sortable table: item, type, interval, next review
│   │
│   ├── ui/
│   │   ├── FocusPicker.tsx          # 4-option focus selector (home screen)
│   │   ├── ModePicker.tsx           # Toggle: Type/Select vs Drag & Drop
│   │   ├── SessionSizePicker.tsx    # Radio: 10 items | Full set
│   │   ├── ReviewAllButton.tsx      # Entry point for cross-focus SRS review
│   │   ├── ProgressBar.tsx
│   │   ├── GeoLabel.tsx             # Renders "Shanghai (上海)" or "Paris" format
│   │   └── Tooltip.tsx
│   │
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
│
├── hooks/
│   ├── useQuizSession.ts            # Session state machine (idle|active|review|done)
│   ├── useSRSQueue.ts               # Fetch due cards by focus or across all focuses
│   ├── useMapLayer.ts               # Load + memoize GeoJSON for active focus
│   ├── useFuzzyMatch.ts             # Fuse.js wrapper
│   ├── useDragDrop.ts               # @dnd-kit sensor config + collision detection
│   └── useAutoZoom.ts               # D3-geo bounds computation + animated zoom
│
├── store/
│   └── appStore.ts                  # Zustand global state
│
├── db/
│   ├── geoDB.ts                     # idb schema: 'geo_cards', 'sessions', 'settings'
│   ├── cardOps.ts                   # CRUD for GeoCard
│   ├── sessionOps.ts                # CRUD for QuizSession
│   └── settingsOps.ts               # Read/write AppSettings
│
├── data/
│   ├── us-states.json
│   ├── us-points.json
│   ├── world-countries.json
│   ├── world-capitals.json
│   ├── china-provinces.json
│   ├── china-points.json
│   ├── europe-countries.json
│   └── europe-points.json
│
├── lib/
│   ├── sm2.ts                       # SM-2 algorithm (port from vocab SRS app)
│   ├── itemUtils.ts                 # id generation, alias lookup, label formatting
│   └── projections.ts               # D3-geo projection configs + bounds computation
│
└── types/
    └── geo.ts                       # All shared TypeScript interfaces
```

---

## 6. Quiz Mode Specifications

### 6.1 Item Rendering by Type

Within a single quiz session, the queue may contain any mix of regions, capitals, and cities. Rendering adapts to `itemType`:

| itemType | Visual target | Auto-zoom behavior |
|---|---|---|
| `region` | Highlighted polygon (pulsing fill) | Zoom to polygon bounding box via `fitExtent()` |
| `capital` | Pulsing ring on point marker | Zoom to fixed scale (zoom=5) centered on coordinates |
| `city` | Pulsing ring on point marker | Zoom to fixed scale (zoom=5) centered on coordinates |

Micro-state polygons (Vatican, Monaco, Luxembourg, etc.) get a maximum zoom ceiling to prevent over-zooming.

---

### 6.2 Type / Select Mode

The active item is highlighted on the map. The map auto-zooms to fit it. The user types an answer or selects from a dropdown.

#### Answer Validation

- **Primary match:** exact string comparison against `GeoItem.nameEn` (case-insensitive, trimmed)
- **Fuzzy fallback:** Fuse.js threshold `0.35` against `nameEn` + all `aliases`
- **China focus:** also accept `nameLocal` (汉字) as a valid answer
- **Attempts:** 2 allowed before answer is revealed and marked incorrect
- **No partial credit:** binary correct/incorrect per attempt

#### SM-2 Quality Mapping

| Quality (q) | Condition |
|---|---|
| 5 | Correct on first attempt, exact match |
| 4 | Correct with fuzzy match (minor typo) |
| 3 | Correct via dropdown selection |
| 2 | Correct on second attempt |
| 1 | Incorrect — answer revealed |
| 0 | Gave up / skipped |

#### Dropdown Mode

Triggered by clicking "Show options" or pressing Tab. Shows 4 shuffled candidates: the correct answer + 3 distractors drawn from the **same focus and same itemType** (i.e., distractors for a capital are other capitals, not country names). Scored at q=3.

---

### 6.3 Drag-and-Drop Mode

All N labels appear in a sidebar pool. The map displays all targets simultaneously. Auto-zoom fits the union bounding box of all session items at session start and holds fixed for the duration. User drags labels onto correct targets.

#### Label Chips

- Display in `GeoLabel` format (see §8)
- Color states: unplaced (slate), placed-correct (teal), placed-incorrect (amber)
- Incorrect placements snap back to pool after 600ms
- Re-dragging allowed until round ends

#### Keyboard Snap Shortcut

A text input sits above the label pool, focused whenever no drag is active. Fuse.js matches typed text against unplaced chip names (threshold `0.35`). When top result score exceeds `0.7`, the matching chip highlights. Pressing Enter snaps it to its correct target (q=3).

- Input clears after successful snap or on Escape
- If multiple candidates exceed threshold: highlight all, wait for arrow-key selection before snapping

#### Drop Targets

- **Regions:** entire SVG polygon path; `pointerWithin` collision detection
- **Capitals and cities:** visible dot at `r=8px`; invisible hit zone at `r=22px` (`pointer-events: all`)
- **Dense areas** (e.g. Benelux, China coastal provinces): stacked chip indicator; drop resolves to topmost target under pointer

#### Scoring

All drag-drop placements (mouse, touch, or keyboard snap) score q=3. Session ends when all labels are correctly placed or user submits.

---

### 6.4 Review All Mode

- Entry point from home screen via dedicated **"Review All"** button
- Only SRS review — no new item introduction
- Pulls due `GeoCard`s across all four focuses, sorted by `nextReview ASC`
- Session size options: 10 or all due items
- Uses the same `QuizController`, `TypeSelectQuiz`, and `DragDropQuiz` components as single-focus mode
- Map base layer switches automatically per item based on `GeoItem.focus`:
  - `us` → USMap
  - `world` → WorldMap
  - `china` → ChinaMap
  - `europe` → EuropeMap

---

## 7. Spaced Repetition System

Uses the same SM-2 implementation as the vocab SRS app — port `lib/sm2.ts` directly.

### 7.1 Queue Construction — Single Focus

1. Fetch all `GeoCard`s for the selected focus where `nextReview ≤ Date.now()`
2. **Session size = 10:** up to 10 due cards sorted by `nextReview ASC`; fill remaining slots with unseen items (stub cards not yet created)
3. **Session size = 'all':** all due cards, then all unseen items
4. Drag-drop randomizes order; type/select uses due-first ordering

### 7.2 Queue Construction — Review All

1. Fetch all `GeoCard`s across all focuses where `nextReview ≤ Date.now()`
2. Sort by `nextReview ASC` (most overdue first)
3. **Session size = 10:** top 10 due cards
4. **Session size = 'all':** all due cards
5. No unseen items introduced in Review All mode

### 7.3 New Item Bootstrapping

On first session for a given focus, stub `GeoCard`s are created for all items in that focus with `interval=0`, `repetitions=0`, `nextReview=0`. Stubs are created lazily (per focus, on first access) rather than all at once on app load.

---

## 8. Label Formatting Rules

The `GeoLabel` component and all answer validation logic must follow these rules.

| Focus | Item | nameEn | nameLocal | Display |
|---|---|---|---|---|
| US | State | California | — | `California` |
| US | Capital | Sacramento | — | `Sacramento` |
| US | City | Los Angeles | — | `Los Angeles` |
| World | Country | France | — | `France` |
| World | Capital | Paris | — | `Paris` |
| China | Province | Guangdong | 广东 | `Guangdong (广东)` |
| China | Capital | Guangzhou | 广州 | `Guangzhou (广州)` |
| China | City | Shenzhen | 深圳 | `Shenzhen (深圳)` |
| China | Municipality | Beijing | 北京 | `Beijing (北京)` |
| Europe | Country | Germany | — | `Germany` |
| Europe | Capital | Berlin | — | `Berlin` |
| Europe | City | Milan | — | `Milan` |

> **Rule:** `nameLocal` (汉字) is shown in parentheses after the English name for China focus items only. No pinyin anywhere in the UI. Pinyin may appear in `aliases[]` for fuzzy-match purposes only.

---

## 9. Map Rendering Details

### 9.1 Projections

| Focus | Base Map | Projection | Notes |
|---|---|---|---|
| US | USMap | AlbersUSA | Insets AK and HI |
| World | WorldMap | Natural Earth (`NaturalEarth1`) | Aesthetically balanced |
| China | ChinaMap | Mercator (centered ~105°E, 35°N) | China fits cleanly |
| Europe | EuropeMap | Mercator (centered ~15°E, 54°N) | Clipped to European extent |

### 9.2 Auto-Zoom Behavior

Auto-zoom is always on. Behavior depends on `itemType`:

- **Regions:** `useAutoZoom` computes D3-geo `fitExtent()` on the polygon geometry; animated via `MapContainer` `center`/`zoom` props with `transition: all 0.4s ease`
- **Capitals and cities:** zoom to fixed scale (zoom=5) centered on `coordinates`
- **Drag-drop sessions:** zoom to union bounding box of all session items at session start; held fixed for the duration
- **Micro-states:** maximum zoom ceiling of zoom=8 (prevents over-zooming Vatican, Monaco, San Marino, Liechtenstein, etc.)
- **Review All:** map base layer switches per item; zoom resets and recomputes for each new item

### 9.3 Visual States

| State | Fill | Notes |
|---|---|---|
| Default | `#EEF4F7` | Stroke `#3D5166` @ 0.5px |
| Hovered | `#C8DDE8` | Cursor pointer |
| Active (quiz target) | `#1B7F8E` | Pulse: opacity 0.7→1.0, 1.2s infinite |
| Correct reveal | `#2ECC71` | 1.5s then resets |
| Incorrect reveal | `#E8A838` | Correct item shown green simultaneously |
| Answered (drag-drop) | Muted green | Non-interactive |

### 9.4 Point Markers (PointLayer)

- Default: `r=8px`, fill=`#0D1B2A`, stroke=`white` 1.5px
- Capitals: same style but with a small star icon overlay (SVG `★` at center)
- Hit zone: invisible `r=22px` circle (`pointer-events: all`)
- Tooltip on hover: item name in `GeoLabel` format
- Active quiz target: pulsing ring animation

### 9.5 Progress Dashboard Choropleth (ProgressMapView)

Mastery color scale based on SM-2 `interval`:

| Interval | Fill | Label |
|---|---|---|
| Unseen (no card yet) | `#D0D9E0` | Not yet studied |
| 0–1 days | `#F4A261` | Learning |
| 2–6 days | `#E9C46A` | Familiar |
| 7–20 days | `#90C987` | Solid |
| 21+ days | `#2ECC71` | Mastered |

Point markers (capitals, cities) use the same color scale applied to their dot fill. The progress map shows all four focuses via focus tabs within `ProgressDashboard`.

---

## 10. @dnd-kit Configuration

```ts
// hooks/useDragDrop.ts
import {
  MouseSensor, TouchSensor, KeyboardSensor,
  useSensors, useSensor, pointerWithin, closestCenter
} from '@dnd-kit/core';

const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 8 },
  }),
  useSensor(KeyboardSensor),
);

// Collision strategy:
// - pointerWithin for region polygons (large SVG areas)
// - closestCenter fallback for point targets (small hit zones)
const collisionDetection = customCollisionDetection; // lib/itemUtils.ts
```

Each label chip in `LabelPool` is `<Draggable id={item.id}>`. Each map polygon and point hit zone is `<Droppable id={item.id}>`. On `onDragEnd`, `QuizController` compares `active.id` to `over.id` and scores.

---

## 11. State Management (Zustand)

```ts
// store/appStore.ts
interface AppState {
  // Session config
  activeFocus: Focus | null;
  sessionScope: SessionScope;       // Focus | 'all'
  quizMode: 'type_select' | 'drag_drop';
  sessionSize: 10 | 'all';
  settings: AppSettings;

  // Active session
  session: QuizSession | null;
  currentItemIndex: number;

  // UI
  tooltipItemId: string | null;
  highlightedItemId: string | null;

  // Actions
  setFocus: (focus: Focus) => void;
  setScope: (scope: SessionScope) => void;
  setMode: (mode: 'type_select' | 'drag_drop') => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  startSession: (queue: string[]) => void;
  recordResult: (result: QuizResult) => void;
  advanceQueue: () => void;
  endSession: () => void;
}
```

---

## 12. IndexedDB Schema

```ts
// db/geoDB.ts
const DB_NAME = 'geoquiz-db';
const DB_VERSION = 1;

// Object store: geo_cards
// keyPath: 'id'
// Indexes:
//   by_focus          → keyPath: 'focus'
//   by_nextReview     → keyPath: 'nextReview'
//   by_focus_due      → keyPath: ['focus', 'nextReview']   (compound — primary query pattern)
//   by_all_due        → keyPath: 'nextReview'              (Review All mode)

// Object store: sessions
// keyPath: 'id'
// Indexes:
//   by_startedAt      → keyPath: 'startedAt'
//   by_scope          → keyPath: 'scope'

// Object store: settings
// keyPath: 'key'      (single record, key = 'app_settings')
```

---

## 13. Routing & Screen Flow

```
/                     → HomeScreen
                          - FocusPicker (4 focus cards)
                          - ModePicker (Type/Select | Drag & Drop)
                          - SessionSizePicker (10 | All)
                          - ReviewAllButton (bypasses focus selection)

/quiz/setup           → QuizSetup
                          - Shows queue preview (due count + new count)
                          - For Review All: shows breakdown by focus

/quiz/session         → QuizSession
                          - TypeSelectQuiz or DragDropQuiz
                          - MapContainer switches base map per item in Review All mode

/quiz/results         → SessionSummary
                          - Score, per-focus breakdown (Review All), SRS schedule, retry

/progress             → ProgressDashboard
                          - Focus tabs: US | World | China | Europe
                          - Map/list toggle within each tab

/settings             → Settings
                          - Reset progress (per focus or all)
```

---

## 14. Territory Policy

Disputed territories are assigned to their most widely accepted jurisdiction and treated as ordinary items — no special flags, no settings toggle.

| Territory | Treatment |
|---|---|
| Taiwan | China province (中华台北 / Taiwan) |
| Tibet Autonomous Region | China province (西藏 / Tibet) |
| Hong Kong, Macau | China SARs — included as provincial-level units |
| Crimea | Part of Ukraine |
| Western Sahara | Part of Morocco |
| Palestinian Territories | Independent state in World + Europe focuses, labeled "Palestinian Territories" |
| Kosovo | Independent country in Europe focus |
| Northern Cyprus | Part of Cyprus |
| South Ossetia / Abkhazia | Part of Georgia |
| Nagorno-Karabakh | Part of Azerbaijan |

---

## 15. V2 Candidates

- Reverse mode: show a name, click the correct region on the map
- Capital-only quiz mode within a focus
- Spain regions (comunidades autónomas)
- Italian regions (regioni) + French départements
- Cloud sync via optional backend (Supabase/PocketBase)
- Integration with vocab SRS app: geo cards in the same review queue

---

## 16. Suggested Implementation Order

### Phase 1 — Foundation
- Vite + React + TypeScript scaffold; Tailwind + Zustand configured
- IndexedDB schema (`geoDB.ts`); GeoCard CRUD; settings store
- `sm2.ts` ported from vocab SRS app
- Data prep: all 8 GeoJSON files assembled; manual `NAME_ZH` pass for China files; territory assignments verified per §14

### Phase 2 — Map Rendering
- `USMap.tsx` (AlbersUSA), `WorldMap.tsx`, `ChinaMap.tsx`, `EuropeMap.tsx`
- `PointLayer.tsx` — capitals (with star) and cities (plain dot); hover tooltips
- `MapContainer.tsx` — focus-based map switcher
- `useAutoZoom.ts` — `fitExtent()` for polygons; fixed zoom for points; micro-state ceiling

### Phase 3 — Type/Select Quiz
- `QuizController.tsx` session state machine
- `TypeSelectQuiz.tsx`: input + Fuse.js + dropdown fallback
- `FeedbackOverlay.tsx`: simultaneous correct/incorrect reveal
- `RegionHighlight.tsx` + point pulse animation
- `useSRSQueue.ts`: single-focus and Review All queue construction
- `SessionSummary.tsx` with per-focus breakdown for Review All

### Phase 4 — Drag-and-Drop Quiz
- `LabelPool.tsx` with @dnd-kit Draggable chips
- Keyboard snap input (Fuse.js → highlight → Enter; q=3; ambiguity handling)
- `DropTarget.tsx` per item (polygon or enlarged point zone)
- `DragDropQuiz.tsx` orchestration
- Union bounding box zoom at session start; map-switching in Review All drag-drop

### Phase 5 — Progress Dashboard & Settings
- `ProgressMapView.tsx` — choropleth + point dot mastery overlay
- `ProgressListView.tsx` — sortable table; columns: name, focus, type, interval, next review, streak
- `ProgressDashboard.tsx` — focus tabs + map/list toggle
- Settings screen — per-focus and full reset

### Phase 6 — Polish & QA
- Mobile touch testing (TouchSensor tuning; point hit zones on small screens)
- Keyboard accessibility audit
- Vitest unit tests: `sm2`, `itemUtils`, `useFuzzyMatch`, `useAutoZoom`
- Edge cases: micro-state zoom ceiling; dense region drag-drop (Benelux, China coast); Review All map switching latency
- Data audit: verify all capitals are correctly associated with parent regions
