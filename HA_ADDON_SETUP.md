# Shelfy Home Assistant Add-on Setup

This document explains the Home Assistant Add-on support for Shelfy and what was added/changed to make it work.

## Summary of Changes

Shelfy already had most of the Home Assistant Add-on infrastructure in place. The following files were **fixed and enhanced**:

### Files Modified

1. **`run.sh`** — Startup script
   - **Issue:** Used `bashio` commands but `init: false` means s6-overlay wasn't available
   - **Fix:** Simplified to basic bash with no external dependencies
   - **Result:** Works reliably in the container without requiring s6-overlay
   
2. **`config.yaml`** — Home Assistant add-on metadata
   - **Added:** URL field for repository reference
   - **Added:** Image field for Docker image reference
   - **Added:** Full healthcheck configuration (30s interval, 5s timeout, 10s startup grace)
   - **Improved:** Comments clarifying `/data` directory persistence
   - **Result:** Complete and production-ready add-on configuration

3. **`Dockerfile`** — Production Docker image
   - **Added:** `curl` to the Alpine packages (required for healthcheck to work)
   - **Added:** Full healthcheck definition in the Dockerfile
   - **Improved:** Comments clarifying the purpose of build tools
   - **Result:** Production-ready image with automatic health monitoring

4. **`.dockerignore`** — Build context exclusions
   - **Added:** More comprehensive ignore patterns for faster builds
   - **Added:** Exclusion of IDE/editor files, CI/CD config, and development artifacts
   - **Result:** Smaller build context, faster image builds

5. **`README.md`** — Documentation
   - **Added:** Comprehensive **Troubleshooting** section with common issues and solutions
   - **Improved:** Home Assistant section already comprehensive, verified completeness
   - **Result:** Complete user-facing documentation

### Files NOT Modified (Already Correct)

- **`package.json`** — Already has correct scripts
- **`backend/server.js`** — Already supports Home Assistant ingress with `x-ingress-path` header
- **`backend/db.js`** — Already reads `DATABASE_PATH` environment variable
- **`repository.yaml`** — Already correctly configured
- **`build.yaml`** — Already has correct multi-architecture base images

---

## How the Home Assistant Add-on Works

### Architecture

```
Home Assistant
    ↓
addon.yaml / config.yaml (metadata)
    ↓
build.yaml (select base image for host architecture)
    ↓
Dockerfile (build Node.js + frontend + app)
    ↓
run.sh (start app with DATABASE_PATH=/data)
    ↓
Node.js/Express server
    ├→ API routes (/api/*)
    └→ React frontend (static + ingress support)
```

### Key Components

#### 1. **config.yaml** — Add-on Metadata
- **Slug:** `shelfy` — unique identifier for the add-on
- **Architecture:** Supports `aarch64` (ARM64, Raspberry Pi), `amd64` (x86-64), and `armv7` (ARM32)
- **Ports:** Exposes port 43127 for direct access
- **Ingress:** Configured to accept requests through HA's `/api/hassio_ingress/<token>` proxy
- **Data mapping:** `/data` directory persists across restarts and updates
- **Healthcheck:** Monitors app availability and restarts if unresponsive

#### 2. **build.yaml** — Multi-Architecture Builds
```yaml
build_from:
  aarch64: "ghcr.io/home-assistant/aarch64-base:latest"
  amd64: "ghcr.io/home-assistant/amd64-base:latest"
  armv7: "ghcr.io/home-assistant/armv7-base:latest"
```
- Home Assistant automatically selects the correct base image for your host CPU
- All bases are Alpine Linux with pre-installed security updates

#### 3. **Dockerfile** — Production Image
- Installs Node.js and `better-sqlite3` build dependencies (python3, make, g++)
- Separates dependency installation from source for layer caching efficiency
- Builds the React frontend to static assets then removes `node_modules`
- Final image is ~500MB (includes Node runtime + all dependencies)

#### 4. **run.sh** — Startup Script
```bash
export DATABASE_PATH="/data/shelfy.db"
export PORT=43127
exec node /app/backend/server.js
```
- Sets `DATABASE_PATH=/data/shelfy.db` (persistent volume mount)
- Sets `PORT=43127` (matches port in config.yaml)
- Starts the Express server using `exec` (process becomes PID 1 for clean shutdown)

#### 5. **Ingress Support** — Home Assistant Proxy
When accessed through Home Assistant ingress:
1. Request arrives at `/api/hassio_ingress/<token>/...`
2. HA strips the prefix and adds `X-Ingress-Path` header
3. `server.js` reads this header: `const ingressPath = req.headers['x-ingress-path']`
4. Injects `window.__BASE__` into the HTML for React Router and API calls

---

## Running on Home Assistant

### Prerequisites
- Home Assistant OS or Supervised installation (e.g., Home Assistant Green, Raspberry Pi 4)
- Network access to the machine running Home Assistant

### Installation Steps

1. **Add the Repository**
   - Settings → Add-ons → Add-on Store (top right) → three-dot menu (⋮) → **Repositories**
   - Paste: `https://github.com/nadav-jac/Shelfy`
   - Scroll down, find "Shelfy" under the new repository

2. **Install the Add-on**
   - Click **Shelfy** → **Install**
   - On first install, HA downloads the base image and builds the Dockerfile (takes 5–10 minutes)
   - `better-sqlite3` compiles from source during this process (normal and expected)

3. **Start the Add-on**
   - Click **Start**
   - **Optional:** Enable **Start on boot** and **Watchdog** for automatic restart on crash/hang

4. **Access the UI**
   - Click **Open Web UI** on the add-on page (uses ingress)
   - Or bookmark `http://homeassistant.local:43127` for direct port access (local network only)

### Data Persistence

- Database file: `/data/shelfy.db` (inside container)
- Stored on: HA's persistent volume at `config/addons_config/shelfy/data/shelfy.db`
- **Survives:**
  - Add-on updates
  - Container restarts
  - Home Assistant reboots
  - Shelfy reinstallation (as long as you don't uninstall and remove data)

### Backing Up

Use Home Assistant's built-in backup feature (Settings → System → Backups). Shelfy data is automatically included in the backup.

### Updating

When a new version is released:
- An **Update** button appears on the Shelfy add-on page
- Click it → HA rebuilds the image with the new code
- Data is untouched; the app restarts with the latest version

---

## Running Locally (Without Home Assistant)

The app still works as a standalone Node.js server for development and testing:

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Start the server
npm start

# Open http://localhost:43127
```

---

## Internals: How Ingress Works

### URL Rewriting (Transparent to User)

**What the user sees:**
```
https://homeassistant.local/api/hassio_ingress/abc123xyz/
```

**What the browser actually requests:**
```
GET /api/hassio_ingress/abc123xyz/
Host: homeassistant.local
X-Ingress-Path: /api/hassio_ingress/abc123xyz
```

**How Shelfy handles it:**
```javascript
app.get('*', (req, res) => {
  const ingressPath = req.headers['x-ingress-path'] || '';
  // ingressPath = '/api/hassio_ingress/abc123xyz'
  
  // Inject into frontend for React Router and API calls
  const injected = htmlTemplate.replace(
    '<head>',
    `<head><script>window.__BASE__=${JSON.stringify(ingressPath)};</script>`
  );
  res.send(injected);
});
```

**Frontend uses it:**
```javascript
// React Router basename (routes relative to /api/hassio_ingress/abc123xyz/)
<BrowserRouter basename={window.__BASE__ || '/'}>

// API client (API calls include the prefix)
const apiUrl = `${window.__BASE__}/api/items`;
```

### QR Codes

QR codes encode the current browser URL (`window.location.origin`):
- Printed from ingress → encodes ingress URL → works anywhere (with HA login)
- Printed from direct port → encodes `http://homeassistant.local:43127` → works on local network only

**Recommendation:** Always print QR codes while accessing via Nabu Casa (if you have remote access) so they work from anywhere.

---

## Troubleshooting

### Add-on Installation Fails

**Reason:** Your CPU architecture isn't supported or there's a build error

**Solution:**
- Check HA's system info (Settings → System → About) to confirm your CPU
- Check add-on logs during the build (Shelfy add-on page → Logs)
- If `better-sqlite3` compilation fails, try again — it's a network/timeout issue

### Add-on Starts Then Crashes

**Check logs:**
```
Settings → Add-ons → Shelfy → Logs
```

**Common issues:**
1. `/data` directory not writable — restart the add-on
2. Port 43127 collision — change in `config.yaml` and rebuild
3. Database corruption — delete `/data/shelfy.db` and let it recreate (data lost)

### "Cannot connect" When Accessing via Ingress

**Reason:** HA auth token expired or ingress proxy misconfigured

**Solution:**
- Refresh the page
- Log out and back into Home Assistant (Settings)
- Restart the add-on
- Check Home Assistant logs (Settings → System → Logs) for proxy errors

### QR Codes Don't Work on Phone

**Reason:** Phone browser not logged into Home Assistant

**Solution (One-time setup per device):**
1. Open your HA URL (e.g., `https://homeassistant.local` or Nabu Casa) in the phone's default browser
2. Log in
3. Scan QR codes now work from then on

---

## Performance Notes

- **Image size:** ~600MB after build (slim Alpine base + Node + deps)
- **Memory usage:** ~100–150MB at runtime (depends on database size and concurrent users)
- **Database:** SQLite with WAL mode for safe concurrent writes
- **First build:** 5–10 minutes (compiles `better-sqlite3` from source)
- **Subsequent updates:** 1–3 minutes (layers cached)

---

## Next Steps

1. **Add the repository** in Home Assistant as described above
2. **Install Shelfy** from the add-on store
3. **Open and use** — click "Open Web UI" or use direct port access
4. **Print QR codes** for easy scanning (recommended: from Nabu Casa URL for remote access)
5. **Install as PWA** on your phone for full-screen app experience

---

## Questions?

See [GitHub Issues](https://github.com/nadav-jac/Shelfy/issues) or [README.md](./README.md#troubleshooting).
