# Shelfy

A simple home storage manager. Track what's in your cabinets, shelves, and boxes — and find it fast.

## Stack

| Layer    | Tech                                    |
|----------|-----------------------------------------|
| Frontend | React 18 + Vite + React Router v6 + PWA |
| Backend  | Node.js + Express                       |
| Database | SQLite (via `better-sqlite3`)           |

## Data model

```
Locations  (rooms, areas)
  └── Containers  (cabinets, shelves, boxes, drawers, bags)
        └── Items  (things, with quantity and optional tags)
```

---

## Running on Home Assistant (recommended)

Shelfy runs as a native Home Assistant Add-on on Home Assistant OS / Supervised installs (e.g. Home Assistant Green). This is the recommended way to run it — the add-on handles everything automatically and keeps the app always available on your home network.

### Install from GitHub

1. In Home Assistant → **Settings → Add-ons → Add-on Store** → three-dot menu (⋮) → **Repositories**
2. Add: `https://github.com/nadav-jac/Shelfy`
3. Scroll to the bottom of the store — **Shelfy** appears under the new repository
4. Click **Install** — HA builds the Docker image (takes a few minutes the first time; `better-sqlite3` compiles from source for your CPU architecture)
5. Click **Start**. Enable **Start on boot** and **Watchdog** if you want it always available.

### Accessing the UI

**Via Home Assistant ingress:**

Once the add-on is running, click **Open Web UI** on the add-on page. The URL looks like:

```
http://homeassistant.local/api/hassio_ingress/<token>/
```

Shelfy also appears in the HA sidebar (enable the **Show in sidebar** toggle on the add-on page).

**Via Nabu Casa (remote access, anywhere):**

If you have a Nabu Casa subscription, the same **Open Web UI** button works from outside your home network through your `https://xxx.ui.nabu.casa` cloud URL. No port forwarding needed.

**Via direct port (local network only):**

```
http://homeassistant.local:43127
```

Useful for bookmarks and PWA installation. Does not work through Nabu Casa.

### Data persistence

The SQLite database lives at `/data/shelfy.db` inside the container. HA maps this to a persistent volume — your data survives add-on updates, container restarts, and HA reboots.

To back up: use HA's built-in **Backup** feature (Settings → System → Backups), which includes add-on data volumes.

### Updating

When a new version is published to GitHub, an **Update** button appears on the add-on page. Click it — HA rebuilds the image. Your data is untouched.

> If no Update button appears: go to the Add-on Store → three-dot menu → **Reload**, then return to the Shelfy page.

---

## Running standalone (without Home Assistant)

Shelfy also runs as a plain Node.js process, with no Docker or HA required.

### 1. Install dependencies

```bash
npm install
```

Installs dependencies for both `backend/` and `frontend/` via the root `postinstall` hook.

### 2. Build the frontend

```bash
npm run build
```

Compiles the React app into `frontend/dist/`.

### 3. Start the server

```bash
npm start
```

Open **http://localhost:43127** — the same process serves both the API and the UI.

### Configuration (optional)

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `43127` | Port the server listens on |
| `VITE_PUBLIC_BASE_URL` | _(none)_ | Base URL embedded in QR codes — only needed if you want to override the automatic detection (see QR section below) |

---

## Installing on mobile (PWA)

Shelfy is a Progressive Web App. Once the server is running, install it on your phone like a native app.

**Android (Chrome):** three-dot menu → **Add to Home screen** → **Install**

**iOS (Safari):** Share button → **Add to Home Screen** → **Add**

The installed app opens full-screen with no browser chrome. Static assets load instantly from cache. See [Offline support](#offline-support) for what works without a network connection.

**Keeping data fresh:** Every page has a **Refresh** button (↻) in the header. Data also refreshes automatically when you switch back to the app tab. On mobile, **pull down** from the top of any page to refresh.

---

## Printing QR labels

Each container has a QR code that links directly to it.

1. Open a container and tap the QR icon (⊞) in the header
2. Click **Print QR** — opens the print page in a new tab
3. The print dialog opens automatically

The printed label is scannable with any phone camera. Scanning opens the container page with the **Add Item** form pre-opened.

### QR codes and remote access

QR codes encode whatever URL you are currently using to access Shelfy:

- **Printed from your Nabu Casa URL** (`https://xxx.ui.nabu.casa/...`): works from anywhere with an internet connection — at home, away, or on mobile data.
- **Printed from the local URL** (`http://homeassistant.local:43127`): works on your home network only.

**Tip:** Always print QR labels while accessing Shelfy through your Nabu Casa URL.

### The scanning browser must be logged into Home Assistant

Shelfy is served through HA ingress, which requires an active Home Assistant session. When a phone camera scans a QR code and opens the link, it uses the phone's **default browser**. If that browser has never been logged into your Home Assistant / Nabu Casa account, it will get an authentication error.

**One-time setup per device:**
1. Open your Nabu Casa URL (`https://xxx.ui.nabu.casa`) in the browser your phone camera uses to open links (usually Safari on iPhone, Chrome on Android).
2. Log into Home Assistant.
3. From then on, scanning any QR code opens directly in the app — no further login needed.

> **Note for Mac:** macOS opens scanned/clicked links in the system default browser. If you get an authentication error, log into Home Assistant in that browser first.

### QR codes without any network (offline)

If there is no network at all (no WiFi, no mobile data), scanning a QR code still works for containers you have previously opened while online. Shelfy falls back to a local IndexedDB cache — see [Offline support](#offline-support).

---

## Offline support

Shelfy supports offline use for container pages using IndexedDB.

### What works offline

| Action | Offline |
|--------|---------|
| Open a previously visited container | Yes — loaded from local cache |
| Add an item | Yes — appears immediately, syncs when back online |
| Delete an item | Yes — removed immediately, syncs when back online |
| Scan a QR code (previously visited container) | Yes — resolved from local catalog |
| Edit an item | No — network required |
| Search | No — requires server |
| Locations / location detail | No — not cached |

### How sync works

1. When you open a container online, a full snapshot (container info + items) is saved to IndexedDB.
2. If you add or delete items offline, the change appears immediately and is added to a pending queue.
3. The queue is replayed automatically when the device comes back online, when the tab becomes visible, or when you tap **Sync now** on the container page.
4. Mutations are processed in order. Network failure pauses the queue; it retries on the next trigger. A server error (e.g. item already deleted) drops that mutation and continues.

If you add an item offline and delete it before it syncs, Shelfy collapses the pair — no create/delete round-trip is sent to the server.

### Indicators

- **Offline bar** — amber banner when offline, with "showing cached data" note
- **Pending changes bar** — blue banner when online with unsynced mutations, with a **Sync now** button
- **Pending badge** — items added offline are labeled *pending* until synced
- Items added offline have a slightly yellow-tinted card border

---

## Development

When working on the frontend, run the Vite dev server alongside the backend for hot module replacement:

```bash
# Terminal 1 — backend with auto-reload
npm run dev:api

# Terminal 2 — Vite dev server (proxies /api → localhost:43127)
npm run dev:ui
```

Open **http://localhost:5173**.

### npm scripts

| Script | What it does |
|---|---|
| `npm install` | Installs all dependencies (root postinstall hook) |
| `npm run build` | Builds the React frontend into `frontend/dist/` |
| `npm start` | Starts the Express server (serves API + built UI) |
| `npm run dev:api` | Starts the backend with nodemon (auto-reload) |
| `npm run dev:ui` | Starts the Vite dev server with HMR |

---

## Project structure

```
Shelfy/
├── config.yaml             # Home Assistant add-on metadata (ingress, port, arch)
├── build.yaml              # HA base image per architecture (aarch64, amd64, armv7)
├── repository.yaml         # HA add-on repository descriptor
├── Dockerfile              # Production Docker image (Node + build tools + app)
├── run.sh                  # Add-on startup script (sets DATABASE_PATH, PORT)
├── icon.png                # Add-on icon shown in the HA store and add-on page
├── .env.example            # Copy to .env to configure port / QR base URL
├── .gitignore
├── package.json            # Root scripts (build, start, dev:*)
│
├── backend/
│   ├── server.js           # Express entry point — serves API + static frontend,
│   │                       # injects window.__BASE__ for HA ingress support
│   ├── db.js               # SQLite connection & schema (auto-created on first run)
│   ├── app.js              # Express app factory (used by server + tests)
│   ├── routes/
│   │   ├── locations.js
│   │   ├── containers.js
│   │   ├── items.js
│   │   └── search.js
│   └── package.json
│
└── frontend/
    ├── index.html          # PWA meta tags (theme-color, apple-touch-icon, etc.)
    ├── vite.config.js      # Relative base path + dev server proxy + VitePWA config
    ├── public/
    │   ├── favicon.svg
    │   └── icons/
    │       ├── icon-192.svg    # PWA icon (Android home screen)
    │       └── icon-512.svg    # PWA icon (splash screen / maskable)
    ├── src/
    │   ├── main.jsx            # App entry — BrowserRouter with window.__BASE__ basename
    │   ├── App.jsx
    │   ├── App.css
    │   ├── api.js              # API client — uses window.__BASE__ prefix for ingress
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── Modal.jsx
    │   │   └── ContainerQRCode.jsx  # QR URL built from current browser origin
    │   ├── hooks/
    │   │   ├── useOnlineStatus.js
    │   │   └── usePullToRefresh.js
    │   ├── pages/
    │   │   ├── LocationsPage.jsx
    │   │   ├── LocationDetailPage.jsx
    │   │   ├── ContainerDetailPage.jsx
    │   │   ├── ScanContainerPage.jsx   # QR scan handler — falls back to offline cache
    │   │   ├── SearchPage.jsx
    │   │   └── PrintContainerPage.jsx
    │   └── services/
    │       ├── offlineDB.js        # IndexedDB layer (cache, pending mutations, catalog)
    │       └── syncEngine.js       # Replays pending mutations when back online
    └── package.json
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/locations | List all locations (with container count) |
| GET | /api/locations/:id | Get location with its containers |
| POST | /api/locations | Create location |
| PUT | /api/locations/:id | Update location |
| DELETE | /api/locations/:id | Delete location (cascades) |
| GET | /api/containers/:id | Get container with its items |
| GET | /api/containers/qr/:token | Get container by QR token |
| POST | /api/containers | Create container |
| PUT | /api/containers/:id | Update container |
| DELETE | /api/containers/:id | Delete container (cascades) |
| POST | /api/items | Create item |
| PUT | /api/items/:id | Update item |
| DELETE | /api/items/:id | Delete item |
| GET | /api/search?q=term | Search items by name, description, tags |
