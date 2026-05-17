# Shelfy — Home Assistant Add-on

A simple home storage manager. Track what's in your cabinets, shelves, and boxes — and find it fast.

This repository contains the **Shelfy Home Assistant add-on**.
For stable QR code URLs through Nabu Casa, also install the companion integration:
👉 [nadav-jac/shelfy-redirect](https://github.com/nadav-jac/shelfy-redirect)

---

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

## Installing on Home Assistant

### Step 1 — Add the repository

1. **Settings → Add-ons → Add-on Store** → three-dot menu (⋮) → **Repositories**
2. Add: `https://github.com/nadav-jac/Shelfy`
3. Scroll to the bottom of the store — **Shelfy** appears under the new repository

### Step 2 — Install and start

1. Click **Shelfy** → **Install**
   HA builds the Docker image on first install (takes a few minutes — `better-sqlite3` compiles from source for your CPU architecture).
2. Click **Start**
3. Enable **Start on boot** and **Watchdog**

### Step 3 — Install the redirect integration (for stable QR URLs)

QR codes on physical labels need a URL that never changes. The `shelfy_redirect` companion integration provides the stable route `/shelfy/scan/container/<token>` and redirects it to the current Shelfy ingress URL.

Install it from [nadav-jac/shelfy-redirect](https://github.com/nadav-jac/shelfy-redirect) — via HACS or manually. Then add to `/config/configuration.yaml`:

```yaml
shelfy_redirect:
```

Restart Home Assistant.

---

## Accessing the UI

**Via Home Assistant ingress (recommended):**

Click **Open Web UI** on the add-on page. Shelfy also appears in the HA sidebar (enable the **Show in sidebar** toggle).

**Via Nabu Casa (remote access from anywhere):**

The **Open Web UI** button works through your `https://xxx.ui.nabu.casa` cloud URL. No port forwarding needed.

**Via direct port (local network only):**

```
http://homeassistant.local:43127
```

---

## Printing QR labels

Each container has a QR code that links directly to it:

1. Open a container → tap the QR icon (⊞) in the header
2. Click **Print QR** → print dialog opens automatically

QR codes encode the stable URL `/shelfy/scan/container/<qr_token>` relative to your HA base URL (handled by the `shelfy_redirect` integration). The `<qr_token>` is stored in the database and never changes.

**The scanning browser must be logged into Home Assistant once** (the session cookie persists after that). This is a one-time step per device.

### QR codes without any network (offline)

If there is no network at all, scanning a QR code still works for containers previously opened while online. Shelfy falls back to a local IndexedDB cache.

---

## Data persistence

The SQLite database lives at `/data/shelfy.db` inside the container. HA maps this to a persistent volume — your data survives add-on updates, container restarts, and HA reboots.

Back up using HA's built-in **Backup** feature (Settings → System → Backups).

## Updating

When a new version is published, an **Update** button appears on the add-on page. Click it — HA rebuilds the image. Your data is untouched.

> If no Update button appears: Add-on Store → three-dot menu → **Reload**.

---

## Installing on mobile (PWA)

**Android (Chrome):** three-dot menu → **Add to Home screen** → **Install**

**iOS (Safari):** Share button → **Add to Home Screen** → **Add**

The installed app opens full-screen. Static assets load instantly from cache. Pull down from the top of any page to refresh.

---

## Offline support

| Action | Offline |
|--------|---------|
| Open a previously visited container | Yes — local cache |
| Add an item | Yes — syncs when back online |
| Delete an item | Yes — syncs when back online |
| Scan a QR code (previously visited container) | Yes — local catalog |
| Edit an item | No |
| Search | No |
| Locations / location detail | No |

---

## Running standalone (without Home Assistant)

```bash
cd shelfy
npm install       # installs backend + frontend deps
npm run build     # compiles React app to frontend/dist/
npm start         # starts Express on http://localhost:43127
```

In standalone mode Express handles `/shelfy/scan/container/:token` directly (no custom integration needed).

### Configuration

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `43127` | Server port |
| `VITE_PUBLIC_BASE_URL` | _(none)_ | Override QR code base URL (set before `npm run build`) |

### Development

```bash
npm run dev:api   # Terminal 1 — backend with nodemon
npm run dev:ui    # Terminal 2 — Vite dev server with HMR
# Open http://localhost:5173
```

---

## Project structure

```
Shelfy/
├── repository.yaml             # HA add-on repository descriptor
├── README.md
├── .gitignore
│
└── shelfy/                     # ── Home Assistant add-on ───────────────────
    ├── config.yaml             # Add-on metadata (ingress, port, arch, version)
    ├── build.yaml              # HA base image per architecture
    ├── Dockerfile              # Production image (Node + build tools + app)
    ├── run.sh                  # Container startup script
    ├── icon.png                # Add-on icon (HA store + add-on page)
    ├── .env.example            # Copy to shelfy/.env for local config
    ├── package.json            # npm scripts for local dev
    │
    ├── backend/
    │   ├── server.js           # Express — API + static + ingress injection +
    │   │                       # /shelfy/scan/container/:token standalone redirect
    │   ├── db.js               # SQLite schema (reads DATABASE_PATH env var)
    │   ├── app.js              # Express app factory
    │   ├── routes/
    │   │   ├── locations.js
    │   │   ├── containers.js
    │   │   ├── items.js
    │   │   └── search.js
    │   └── package.json
    │
    └── frontend/
        ├── index.html
        ├── vite.config.js      # Relative base path + dev proxy + VitePWA
        ├── public/
        │   ├── favicon.svg
        │   └── icons/
        ├── src/
        │   ├── main.jsx        # BrowserRouter with window.__BASE__ basename
        │   ├── App.jsx
        │   ├── api.js          # API client with window.__BASE__ prefix
        │   ├── components/
        │   │   └── ContainerQRCode.jsx  # Stable /shelfy/scan/... QR URLs
        │   ├── hooks/
        │   ├── pages/
        │   │   ├── ScanContainerPage.jsx  # QR handler + offline fallback
        │   │   └── ...
        │   └── services/
        │       ├── offlineDB.js    # IndexedDB cache + pending mutations
        │       └── syncEngine.js   # Mutation replay on reconnect
        └── package.json
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/locations | List all locations |
| GET | /api/locations/:id | Get location with containers |
| POST | /api/locations | Create location |
| PUT | /api/locations/:id | Update location |
| DELETE | /api/locations/:id | Delete location (cascades) |
| GET | /api/containers/:id | Get container with items |
| GET | /api/containers/qr/:token | Get container by QR token |
| POST | /api/containers | Create container |
| PUT | /api/containers/:id | Update container |
| DELETE | /api/containers/:id | Delete container (cascades) |
| POST | /api/items | Create item |
| PUT | /api/items/:id | Update item |
| DELETE | /api/items/:id | Delete item |
| GET | /api/search?q=term | Search items |

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Add-on won't start | Build or DB error | Check **Logs** tab on the add-on page |
| QR redirect returns 502 | Wrong add-on slug | See [shelfy-redirect README](https://github.com/nadav-jac/shelfy-redirect) |
| QR redirect returns 503 | Add-on not running | Start the add-on |
| Auth error when scanning QR | Browser not logged into HA | Log into HA in the phone's default browser once |
| No Update button | Store cache stale | Add-on Store → three-dot menu → **Reload** |

---

## Support

[GitHub Issues](https://github.com/nadav-jac/Shelfy/issues)
