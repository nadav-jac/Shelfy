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

## Repository contents

This repository contains two separate but related pieces:

| Path | What it is |
|---|---|
| `shelfy/` | The Home Assistant add-on — runs the Shelfy Node/Express app |
| `custom_components/shelfy_redirect/` | A small HA custom integration that provides stable QR code URLs |

**Why two pieces?**

QR codes are printed on physical box labels. Raw HA ingress URLs (e.g. `/api/hassio_ingress/<token>/...`) contain a dynamic token that changes every time the add-on is reinstalled — any printed labels would break. The `shelfy_redirect` integration registers the stable route `/shelfy/scan/container/<qr_token>` on HA's own HTTP server and redirects it to the current ingress URL. This URL never changes, so printed labels last indefinitely.

---

## Running on Home Assistant (recommended)

### Step 1 — Add the repository and install the add-on

1. In Home Assistant → **Settings → Add-ons → Add-on Store** → three-dot menu (⋮) → **Repositories**
2. Add: `https://github.com/nadav-jac/Shelfy`
3. Scroll to the bottom of the store — **Shelfy** appears under the new repository
4. Click **Install** — HA builds the Docker image (takes a few minutes the first time; `better-sqlite3` compiles from source for your CPU architecture)
5. Click **Start**. Enable **Start on boot** and **Watchdog**.

### Step 2 — Install the shelfy_redirect integration

The integration is a small Python file that lives in `custom_components/shelfy_redirect/` in this repository.

**Option A — Copy manually (via Samba or SSH):**

Copy the folder to your HA config directory:

```
custom_components/shelfy_redirect/   →   /config/custom_components/shelfy_redirect/
```

Via SSH:
```bash
scp -r custom_components/shelfy_redirect root@homeassistant:/config/custom_components/
```

**Option B — HACS (if you use it):**

Add this repository as a custom HACS repository (type: Integration), then install `Shelfy Redirect` from HACS.

### Step 3 — Enable the integration

Add to your `/config/configuration.yaml`:

```yaml
shelfy_redirect:
```

That's all that's needed — the `addon_slug` defaults to `shelfy`.

> **If HA uses a different slug:** Some HA configurations prefix add-on slugs. If the redirect returns a 502 error, check the actual slug in **Settings → Add-ons → Shelfy** (it appears in the URL). Then configure:
> ```yaml
> shelfy_redirect:
>   addon_slug: your_actual_slug
> ```

### Step 4 — Restart Home Assistant

Go to **Settings → System → Restart** (or `Developer Tools → Restart`). The integration registers the `/shelfy/scan/container/{token}` route on startup.

---

### Accessing the UI

**Via Home Assistant ingress:**

Once the add-on is running, click **Open Web UI** on the add-on page. The URL looks like:

```
http://homeassistant.local/api/hassio_ingress/<token>/
```

Shelfy also appears in the HA sidebar (enable the **Show in sidebar** toggle on the add-on page).

**Via Nabu Casa (remote access from anywhere):**

If you have a Nabu Casa subscription, the same **Open Web UI** button works from outside your home network through your `https://xxx.ui.nabu.casa` cloud URL. No port forwarding needed.

**Via direct port (local network only):**

```
http://homeassistant.local:43127
```

Useful for bookmarks and PWA installation. Does not work through Nabu Casa.

### Data persistence

The SQLite database lives at `/data/shelfy.db` inside the container. HA maps this to a persistent volume — your data survives add-on updates, container restarts, and HA reboots.

To back up: use HA's built-in **Backup** feature (Settings → System → Backups), which includes add-on data volumes.

### Updating the add-on

When a new version is published to GitHub, an **Update** button appears on the add-on page. Click it — HA rebuilds the image. Your data is untouched.

> If no Update button appears: go to the Add-on Store → three-dot menu → **Reload**, then return to the Shelfy page.

---

## Printing QR labels

Each container has a QR code that links directly to it.

1. Open a container and tap the QR icon (⊞) in the header
2. Click **Print QR** — opens the print page in a new tab
3. The print dialog opens automatically

The printed label is scannable with any phone camera. Scanning opens the container page with the **Add Item** form pre-opened.

### How QR URLs work

QR codes encode the stable URL:

```
https://xxx.ui.nabu.casa/shelfy/scan/container/<qr_token>
```

(or `http://homeassistant.local/shelfy/scan/container/<qr_token>` when accessed locally)

When scanned, this hits the `shelfy_redirect` integration, which looks up the current ingress URL and redirects the browser there. Because the redirect uses a relative path, the correct host (local or Nabu Casa) is preserved automatically.

The `<qr_token>` is a permanent identifier stored in the database. Unlike the ingress token, it never changes — even if you reinstall the add-on.

### One-time browser login

HA ingress requires an active session. When a phone camera scans a QR code and opens the link in its default browser for the first time, HA will show a login page.

**One-time setup per device:**
1. Open your Nabu Casa URL (`https://xxx.ui.nabu.casa`) in the browser your phone camera uses for links (Safari on iPhone, Chrome on Android).
2. Log into Home Assistant.
3. After that, scanning any QR code opens directly in the app — no further login needed.

### QR codes without any network (offline)

If there is no network at all (no WiFi, no mobile data), scanning a QR code still works for containers you have previously opened while online. Shelfy falls back to a local IndexedDB cache — see [Offline support](#offline-support).

---

## Installing on mobile (PWA)

Shelfy is a Progressive Web App. Once the server is running, install it on your phone like a native app.

**Android (Chrome):** three-dot menu → **Add to Home screen** → **Install**

**iOS (Safari):** Share button → **Add to Home Screen** → **Add**

The installed app opens full-screen with no browser chrome. Static assets load instantly from cache.

**Keeping data fresh:** Every page has a **Refresh** button (↻) in the header. Data also refreshes automatically when you switch back to the app tab. On mobile, **pull down** from the top of any page to refresh.

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

## Running standalone (without Home Assistant)

Shelfy also runs as a plain Node.js process, with no Docker or HA required.

```bash
npm install       # installs backend + frontend dependencies
npm run build     # compiles React app into shelfy/frontend/dist/
npm start         # starts Express on http://localhost:43127
```

In standalone mode, QR codes still work: Express handles `/shelfy/scan/container/:token` and redirects to the React scan route. No custom integration needed.

### Configuration (optional)

```bash
cp shelfy/.env.example shelfy/.env
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `43127` | Port the server listens on |
| `VITE_PUBLIC_BASE_URL` | _(none)_ | Override the QR code base URL (set before `npm run build`) |

### Development (two processes)

```bash
npm run dev:api   # Terminal 1 — backend with nodemon auto-reload
npm run dev:ui    # Terminal 2 — Vite dev server with HMR
```

Open **http://localhost:5173**.

---

## Project structure

```
Shelfy/
├── repository.yaml             # HA add-on repository descriptor
├── README.md
├── .gitignore
├── package.json                # Root scripts (build, start, dev:*)
│
├── shelfy/                     # ── Home Assistant add-on ──────────────────────
│   ├── config.yaml             # Add-on metadata (ingress, port, arch, version)
│   ├── build.yaml              # HA base image per architecture
│   ├── Dockerfile              # Production image (Node + build tools + app)
│   ├── run.sh                  # Container startup script
│   ├── icon.png                # Add-on icon (shown in HA store / add-on page)
│   ├── .env.example            # Copy to shelfy/.env for local configuration
│   │
│   ├── backend/
│   │   ├── server.js           # Express entry — API + static frontend +
│   │   │                       # window.__BASE__ injection for HA ingress +
│   │   │                       # /shelfy/scan/container/:token standalone redirect
│   │   ├── db.js               # SQLite connection & schema
│   │   ├── app.js              # Express app factory
│   │   ├── routes/
│   │   │   ├── locations.js
│   │   │   ├── containers.js
│   │   │   ├── items.js
│   │   │   └── search.js
│   │   └── package.json
│   │
│   └── frontend/
│       ├── index.html
│       ├── vite.config.js      # Relative base path + dev proxy + VitePWA
│       ├── public/
│       │   ├── favicon.svg
│       │   └── icons/
│       ├── src/
│       │   ├── main.jsx        # BrowserRouter with window.__BASE__ basename
│       │   ├── App.jsx
│       │   ├── App.css
│       │   ├── api.js          # API client with window.__BASE__ prefix
│       │   ├── components/
│       │   │   ├── Navbar.jsx
│       │   │   ├── Modal.jsx
│       │   │   └── ContainerQRCode.jsx  # Stable /shelfy/scan/... QR URLs
│       │   ├── hooks/
│       │   ├── pages/
│       │   │   ├── ScanContainerPage.jsx  # QR handler, offline fallback
│       │   │   └── ...
│       │   └── services/
│       │       ├── offlineDB.js    # IndexedDB cache + pending mutations
│       │       └── syncEngine.js   # Mutation replay on reconnect
│       └── package.json
│
└── custom_components/          # ── HA custom integration ───────────────────────
    └── shelfy_redirect/
        ├── manifest.json       # Integration metadata
        └── __init__.py         # Registers /shelfy/scan/container/{token} →
                                # redirects to current Shelfy ingress URL
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

---

## Troubleshooting

### Add-on won't start

Go to the Shelfy add-on page → **Logs** tab.

| Problem | Cause | Solution |
|---------|-------|----------|
| `ENOENT /data/shelfy.db` | Data volume not mounted | Restart the add-on |
| Port already in use | Another service on port 43127 | Change port in `shelfy/config.yaml` |
| `better-sqlite3: build failed` | Architecture mismatch | Try rebuilding the add-on image |

### QR redirect returns 502

The integration can't find the add-on. Check the actual slug in **Settings → Add-ons → Shelfy** (it's in the page URL). If it differs from `shelfy`, set `addon_slug` in `configuration.yaml`.

### QR redirect returns 503

The Shelfy add-on is not running. Start it in **Settings → Add-ons → Shelfy → Start**.

### Ingress authentication error

The scanning browser hasn't logged into HA yet. Log in once at your Nabu Casa URL — the session persists.

### Database missing or corrupted

The database lives at `/data/shelfy.db`. Use **Settings → System → Backups** to restore. Or stop the add-on, delete the database file, and restart — a fresh database is created automatically (data will be lost).

---

## Support

For issues, questions, or feature requests, see [GitHub Issues](https://github.com/nadav-jac/Shelfy/issues).
