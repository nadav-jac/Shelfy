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

### 2. Configure the port (optional)

```bash
cp .env.example .env
# Edit .env to change PORT if needed (default: 43127)
```

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

The installed app opens full-screen with no browser chrome, and its static assets (shell, JS, CSS) load instantly from cache even without a network connection. API calls (your data) still require connectivity.

**Keeping data fresh:** Every page has a **Refresh** button (↻) in the header. Data also auto-refreshes whenever you switch back to the app tab — so changes made on another device appear without any manual action. On mobile, **pull down** from the top of any page to refresh.

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
