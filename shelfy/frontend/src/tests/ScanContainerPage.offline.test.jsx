/**
 * Offline QR scan tests for ScanContainerPage.
 *
 * Covers:
 * - Online: standard server resolution (unchanged behaviour)
 * - Offline: token found in catalog → navigates to container
 * - Offline: token not found anywhere → shows unavailable message
 * - Catalog is populated when ContainerDetailPage loads from server
 * - Catalog is populated when LocationDetailPage loads from server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScanContainerPage from '../pages/ScanContainerPage.jsx';
import ContainerDetailPage from '../pages/ContainerDetailPage.jsx';
import LocationDetailPage from '../pages/LocationDetailPage.jsx';
import {
  getContainerFromCatalog,
  upsertContainerInCatalog,
  _resetDB,
} from '../services/offlineDB.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api.js', () => ({
  api: {
    containers: { get: vi.fn(), getByToken: vi.fn() },
    locations: { get: vi.fn() },
    items: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('../services/syncEngine.js', () => ({
  syncPendingMutations: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  isSyncing: vi.fn().mockReturnValue(false),
}));

import { api } from '../api.js';

// ─── Test data ────────────────────────────────────────────────────────────────

const CATALOG_ENTRY = {
  qr_token: 'tok_abc123',
  id: 42,
  name: 'Garage Box',
  type: 'box',
  location_id: 5,
  location_name: 'Garage',
};

const CONTAINER = {
  id: 42,
  name: 'Garage Box',
  type: 'box',
  description: '',
  location_id: 5,
  location_name: 'Garage',
  qr_token: 'tok_abc123',
  items: [],
};

const LOCATION = {
  id: 5,
  name: 'Garage',
  description: '',
  containers: [
    { id: 42, name: 'Garage Box', type: 'box', description: '', qr_token: 'tok_abc123', item_count: 0 },
    { id: 43, name: 'Shelf A',    type: 'shelf', description: '', qr_token: 'tok_def456', item_count: 3 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tracks where navigation ended up (captured by a sentinel route). */
function renderScanPage(token, extraRoutes = null) {
  return render(
    <MemoryRouter initialEntries={[`/scan/container/${token}`]}>
      <Routes>
        <Route path="/scan/container/:token" element={<ScanContainerPage />} />
        <Route path="/containers/:id" element={<div data-testid="container-page">Container {token}</div>} />
        <Route path="/" element={<div data-testid="home">Home</div>} />
        {extraRoutes}
      </Routes>
    </MemoryRouter>
  );
}

function setOnline(online) {
  Object.defineProperty(navigator, 'onLine', { value: online, writable: true, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDB();
  vi.clearAllMocks();
  setOnline(true);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── ScanContainerPage — online ───────────────────────────────────────────────

describe('ScanContainerPage — online', () => {
  it('navigates to the container page after server resolves the token', async () => {
    api.containers.getByToken.mockResolvedValue({ id: 42 });

    renderScanPage('tok_abc123');

    await waitFor(() => expect(screen.getByTestId('container-page')).toBeInTheDocument());
    expect(api.containers.getByToken).toHaveBeenCalledWith('tok_abc123');
  });
});

// ─── ScanContainerPage — offline, token in catalog ───────────────────────────

describe('ScanContainerPage — offline, token known', () => {
  beforeEach(async () => {
    await upsertContainerInCatalog(CATALOG_ENTRY);
    api.containers.getByToken.mockRejectedValue(new TypeError('Failed to fetch'));
    setOnline(false);
  });

  it('navigates to the container page using the local catalog', async () => {
    renderScanPage('tok_abc123');

    await waitFor(() => expect(screen.getByTestId('container-page')).toBeInTheDocument());
    expect(api.containers.getByToken).toHaveBeenCalledWith('tok_abc123');
  });

  it('does not call the API a second time after catalog hit', async () => {
    renderScanPage('tok_abc123');

    await waitFor(() => screen.getByTestId('container-page'));
    expect(api.containers.getByToken).toHaveBeenCalledTimes(1);
  });
});

// ─── ScanContainerPage — offline, token unknown ───────────────────────────────

describe('ScanContainerPage — offline, token unknown', () => {
  beforeEach(() => {
    api.containers.getByToken.mockRejectedValue(new TypeError('Failed to fetch'));
    setOnline(false);
    // Nothing in catalog
  });

  it('shows the offline-unavailable message', async () => {
    renderScanPage('tok_unknown');

    await waitFor(() => expect(screen.getByText(/not available offline/i)).toBeInTheDocument());
  });

  it('does not navigate away from the scan page', async () => {
    renderScanPage('tok_unknown');

    await waitFor(() => screen.getByText(/not available offline/i));
    expect(screen.queryByTestId('container-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });
});

// ─── Catalog population — ContainerDetailPage ────────────────────────────────

describe('Catalog population — ContainerDetailPage', () => {
  it('writes the container to the catalog when loaded from the server', async () => {
    api.containers.get.mockResolvedValue(CONTAINER);

    render(
      <MemoryRouter initialEntries={['/containers/42']}>
        <Routes>
          <Route path="/containers/:id" element={<ContainerDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByRole('heading', { name: 'Garage Box' }));

    const entry = await getContainerFromCatalog('tok_abc123');
    expect(entry).toBeTruthy();
    expect(entry.id).toBe(42);
    expect(entry.qr_token).toBe('tok_abc123');
  });
});

// ─── Catalog population — LocationDetailPage ─────────────────────────────────

describe('Catalog population — LocationDetailPage', () => {
  it('writes all containers in the location to the catalog', async () => {
    api.locations.get.mockResolvedValue(LOCATION);

    render(
      <MemoryRouter initialEntries={['/locations/5']}>
        <Routes>
          <Route path="/locations/:id" element={<LocationDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByRole('heading', { name: 'Garage' }));

    const entry1 = await getContainerFromCatalog('tok_abc123');
    const entry2 = await getContainerFromCatalog('tok_def456');

    expect(entry1).toBeTruthy();
    expect(entry1.id).toBe(42);
    expect(entry1.location_name).toBe('Garage');

    expect(entry2).toBeTruthy();
    expect(entry2.id).toBe(43);
    expect(entry2.name).toBe('Shelf A');
  });
});
