# Shelfy

A simple home storage manager. Track what's in your cabinets, shelves, and boxes — and find it fast.

## Stack

| Layer    | Tech                                         |
|----------|----------------------------------------------|
| Frontend | React 18 + Vite + React Router v6 + PWA      |
| Backend  | Node.js + Express                            |
| Database | SQLite (via `better-sqlite3`)                |

## Data model

```
Locations  (rooms, areas)
  └── Containers  (cabinets, shelves, boxes, drawers, bags)
        └── Items  (things, with quantity and optional tags)
```

---

## Running the app

### 1. Install dependencies

```bash
npm install
```

This installs dependencies for both `backend/` and `frontend/` via the root `postinstall` script.

### 2. Configure environment (optional)

```bash
cp .env.example .env
# Edit .env to change PORT if needed (default: 43127)
```

**Scanning QR codes from a phone:** QR codes encode the URL that will be opened when scanned. By default this uses the origin of the browser tab displaying the QR — which is `localhost` and unreachable from another device. To make QR codes scannable on your local network, set `VITE_PUBLIC_BASE_URL` to your machine's LAN address **before building the frontend**:

```bash
# .env
VITE_PUBLIC_BASE_URL=http://192.168.1.42:43127
```

Find your LAN IP with `ip addr` (Linux) or `ipconfig` (Windows) or `ifconfig` (macOS). Then rebuild with `npm run build`.

### 3. Build the frontend

```bash
npm run build
```

Compiles the React app into `frontend/dist/`.

### 4. Start the server

```bash
npm start
```

Open **http://localhost:43127** — the same process serves both the API and the UI.

---

## Installing on mobile (PWA)

Shelfy is a Progressive Web App. Once the server is running, you can install it on your phone like a native app.

### Android (Chrome)

1. Open the app URL in Chrome.
2. Tap the **three-dot menu** → **Add to Home screen**.
3. Tap **Install** in the prompt that appears.

### iOS (Safari)

1. Open the app URL in Safari.
2. Tap the **Share** button (rectangle with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

The installed app opens full-screen with no browser chrome, and its static assets (shell, JS, CSS) load instantly from cache even without a network connection. API calls (your data) still require connectivity — see [Offline support](#offline-support) below.

**Keeping data fresh:** Every page has a **Refresh** button (↻) in the header. Data also auto-refreshes whenever you switch back to the app tab — so changes made on another device appear without any manual action. On mobile, **pull down** from the top of any page to refresh.

---

## Offline support

Shelfy supports offline use for container pages. The app uses IndexedDB to cache data locally and a simple sync queue to replay changes when connectivity returns.

### What works offline

| Action | Offline support |
|--------|----------------|
| Open a previously visited container | Yes — loaded from local cache |
| Add an item to a container | Yes — item appears immediately, syncs when online |
| Delete an item from a container | Yes — item removed immediately, syncs when online |
| Search | No — requires server |
| Browse locations / location detail | No — no cache for those pages |
| Edit an item | No — network required |

### What is not supported offline

- Containers that have never been opened while online (no cache available)
- Editing items (shows an error if attempted offline)
- Search, locations, and all other pages

### How sync works

1. When you open a container online, the full container snapshot (container info + item list) is saved to IndexedDB.
2. If you add or delete items while offline, the change appears instantly in the UI and a pending mutation is enqueued.
3. Pending mutations are replayed when:
   - The device comes back online (automatic, transparent)
   - The tab becomes visible again (existing refresh behavior, now offline-aware)
   - You tap **Sync now** from the container page
4. Mutations are processed in order. A network failure pauses the queue; it will retry on the next trigger. A server-side error (e.g. item already deleted) drops the mutation and continues.

### Create + delete collapse

If you add an item while offline and then delete it before it syncs, Shelfy detects that and removes the pending create from the queue entirely. No unnecessary create/delete pair is sent to the server.

### Indicators

- **Offline bar** — amber banner shown when offline, including "showing cached data" note
- **Pending changes bar** — blue banner shown when online with unsynced mutations, with a **Sync now** button
- **Pending badge** — each item added offline is labeled *pending* until it syncs
- Items added offline show a slightly yellow-tinted card border

---

## Printing QR labels

Each container has a QR code that links directly to it. To print a physical label:

1. Open a container and tap the QR icon (⊞) in the header.
2. Click **Print QR** — this opens `/print/container/:token` in a new tab.
3. The print dialog opens automatically. The page shows only the QR code, container name, and location — nothing else.

The printed label is scannable with any phone camera. Scanning redirects to the container page with the **Add Item** form pre-opened.

> **Local network:** QR codes must encode your machine's LAN IP, not `localhost`. See the [configuration note above](#2-configure-environment-optional) for `VITE_PUBLIC_BASE_URL`.

---

## Development mode (two processes)

When actively working on the frontend, run the Vite dev server alongside the backend for hot module replacement:

```bash
# Terminal 1 — backend with auto-reload
npm run dev:api

# Terminal 2 — Vite dev server (proxies /api → localhost:43127)
npm run dev:ui
```

Open **http://localhost:5173**.

---

## npm scripts

| Script        | What it does                                        |
|---------------|-----------------------------------------------------|
| `npm install` | Installs all dependencies (root postinstall hook)   |
| `npm run build` | Builds the React frontend into `frontend/dist/`   |
| `npm start`   | Starts the Express server (serves API + built UI)   |
| `npm run dev:api` | Starts the backend with nodemon (auto-reload)   |
| `npm run dev:ui`  | Starts the Vite dev server with HMR              |

---

## API reference

| Method | Endpoint            | Description                               |
|--------|---------------------|-------------------------------------------|
| GET    | /api/locations      | List all locations (with container count) |
| GET    | /api/locations/:id  | Get location with its containers          |
| POST   | /api/locations      | Create location                           |
| PUT    | /api/locations/:id  | Update location                           |
| DELETE | /api/locations/:id  | Delete location (cascades)                |
| GET    | /api/containers/:id | Get container with its items              |
| POST   | /api/containers     | Create container                          |
| PUT    | /api/containers/:id | Update container                          |
| DELETE | /api/containers/:id | Delete container (cascades)               |
| POST   | /api/items          | Create item                               |
| PUT    | /api/items/:id      | Update item                               |
| DELETE | /api/items/:id      | Delete item                               |
| GET    | /api/search?q=term  | Search items by name, description, tags   |

---

## Project structure

```
Shelfy/
├── .env.example            # Copy to .env to configure port
├── .gitignore
├── package.json            # Root scripts (build, start, dev:*)
│
├── backend/
│   ├── server.js           # Express entry point — serves API + static frontend
│   ├── db.js               # SQLite connection & schema (auto-created on first run)
│   ├── routes/
│   │   ├── locations.js
│   │   ├── containers.js
│   │   ├── items.js
│   │   └── search.js
│   └── package.json
│
└── frontend/
    ├── index.html          # PWA meta tags (theme-color, apple-touch-icon, etc.)
    ├── vite.config.js      # Dev server proxy + VitePWA plugin config
    ├── public/
    │   ├── favicon.svg
    │   └── icons/
    │       ├── icon-192.svg    # PWA icon (Android home screen)
    │       └── icon-512.svg    # PWA icon (splash screen / maskable)
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── App.css
    │   ├── api.js
    │   ├── hooks/
    │   │   └── usePullToRefresh.js  # Touch gesture hook for pull-to-refresh
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── Modal.jsx
    │   └── pages/
    │       ├── LocationsPage.jsx
    │       ├── LocationDetailPage.jsx
    │       ├── ContainerDetailPage.jsx
    │       └── SearchPage.jsx
    └── package.json
```
