/**
 * Offline behavior tests for ContainerDetailPage.
 *
 * We mock the API module and the sync engine so tests run without a server.
 * The real offlineDB module is used (via fake-indexeddb from setup.js).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContainerDetailPage from '../pages/ContainerDetailPage.jsx';
import { setCachedContainer, getCachedContainer, getAllPendingMutations, _resetDB } from '../services/offlineDB.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api.js', () => ({
  api: {
    containers: { get: vi.fn() },
    items: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../services/syncEngine.js', () => ({
  syncPendingMutations: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  isSyncing: vi.fn().mockReturnValue(false),
}));

import { api } from '../api.js';
import { syncPendingMutations } from '../services/syncEngine.js';

// ─── Test data ────────────────────────────────────────────────────────────────

const CONTAINER = {
  id: 1,
  name: 'Tool Box',
  type: 'box',
  description: 'Main tools',
  location_id: 10,
  location_name: 'Garage',
  qr_token: 'abc123',
  items: [
    { id: 101, name: 'Hammer', description: '', quantity: 1, tags: '', container_id: 1 },
    { id: 102, name: 'Wrench', description: '', quantity: 2, tags: 'tools', container_id: 1 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setOnline(online) {
  Object.defineProperty(navigator, 'onLine', { value: online, writable: true, configurable: true });
  // Dispatch the appropriate event so the hook updates
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

function renderPage(containerId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/containers/${containerId}`]}>
      <Routes>
        <Route path="/containers/:id" element={<ContainerDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDB();
  vi.clearAllMocks();
  setOnline(true);
  // Suppress window.confirm
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. Container cache reading ───────────────────────────────────────────────

describe('Container page — offline cache reading', () => {
  it('fetches from server and renders when online', async () => {
    api.containers.get.mockResolvedValue(CONTAINER);

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tool Box' })).toBeInTheDocument());
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Wrench')).toBeInTheDocument();
    expect(api.containers.get).toHaveBeenCalledWith('1');
  });

  it('loads from cache when offline and container was previously visited', async () => {
    // Pre-populate cache (simulating a previous online visit)
    await setCachedContainer(CONTAINER);
    setOnline(false);

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tool Box' })).toBeInTheDocument());
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    // API should not have been called
    expect(api.containers.get).not.toHaveBeenCalled();
  });

  it('shows offline indicator when loaded from cache', async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);

    renderPage();

    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());
  });

  it('shows not-available message when offline and container was never cached', async () => {
    setOnline(false);
    // Nothing in cache for container id 1

    renderPage();

    await waitFor(() => expect(screen.getByText(/not available offline/i)).toBeInTheDocument());
    expect(api.containers.get).not.toHaveBeenCalled();
  });

  it('caches the container after a successful online load', async () => {
    api.containers.get.mockResolvedValue(CONTAINER);

    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    const cached = await getCachedContainer(1);
    expect(cached).toBeTruthy();
    expect(cached.name).toBe('Tool Box');
  });
});

// ─── 2. Offline add item ──────────────────────────────────────────────────────

describe('Container page — offline add item', () => {
  beforeEach(async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);
    api.containers.get.mockResolvedValue(CONTAINER);
  });

  it('shows the new item immediately in the UI', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    fireEvent.click(screen.getByText('Add Item'));
    await screen.findByPlaceholderText(/winter jacket/i);

    await userEvent.type(screen.getByPlaceholderText(/winter jacket/i), 'New Bolt');
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(screen.getByText('New Bolt')).toBeInTheDocument());
    // API should not have been called while offline
    expect(api.items.create).not.toHaveBeenCalled();
  });

  it('marks the new item as pending', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    fireEvent.click(screen.getByText('Add Item'));
    await screen.findByPlaceholderText(/winter jacket/i);

    await userEvent.type(screen.getByPlaceholderText(/winter jacket/i), 'Pending Nail');
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(screen.getByTitle('Waiting to sync')).toBeInTheDocument());
  });

  it('enqueues a create_item mutation', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    fireEvent.click(screen.getByText('Add Item'));
    await screen.findByPlaceholderText(/winter jacket/i);

    await userEvent.type(screen.getByPlaceholderText(/winter jacket/i), 'Tape');
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => screen.getByText('Tape'));

    const mutations = await getAllPendingMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].type).toBe('create_item');
    expect(mutations[0].itemData.name).toBe('Tape');
    expect(mutations[0].containerId).toBe(1);
  });
});

// ─── 3. Offline delete item ───────────────────────────────────────────────────

describe('Container page — offline delete item', () => {
  beforeEach(async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);
    api.containers.get.mockResolvedValue(CONTAINER);
  });

  it('removes a server-synced item from the UI immediately', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Hammer'));

    // Find and click delete for Hammer (id 101)
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.queryByText('Hammer')).not.toBeInTheDocument());
    expect(api.items.delete).not.toHaveBeenCalled();
  });

  it('enqueues a delete_item mutation for a server-synced item', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Hammer'));

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.queryByText('Hammer')).not.toBeInTheDocument());

    const mutations = await getAllPendingMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].type).toBe('delete_item');
    expect(mutations[0].itemId).toBe(101);
  });

  it('collapses create+delete for an offline-only item (no server round-trip)', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    // Add an item offline
    fireEvent.click(screen.getByText('Add Item'));
    await screen.findByPlaceholderText(/winter jacket/i);
    await userEvent.type(screen.getByPlaceholderText(/winter jacket/i), 'Ephemeral');
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => screen.getByText('Ephemeral'));

    // Verify a create mutation was enqueued
    let mutations = await getAllPendingMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].type).toBe('create_item');

    // Now delete that same item while still offline
    const deleteButtons = screen.getAllByTitle('Delete');
    const ephemeralDelete = deleteButtons[deleteButtons.length - 1]; // last item
    fireEvent.click(ephemeralDelete);

    await waitFor(() => expect(screen.queryByText('Ephemeral')).not.toBeInTheDocument());

    // Queue should be empty — create and delete collapsed
    mutations = await getAllPendingMutations();
    expect(mutations).toHaveLength(0);
  });
});

// ─── 4. Sync behavior ─────────────────────────────────────────────────────────

describe('Container page — sync behavior', () => {
  it('runs sync and reloads when the user clicks Sync now', async () => {
    await setCachedContainer(CONTAINER);

    // Start online, load normally
    api.containers.get.mockResolvedValue(CONTAINER);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    // Simulate going offline and adding an item to build up pending count
    setOnline(false);
    fireEvent.click(screen.getByText('Add Item'));
    await screen.findByPlaceholderText(/winter jacket/i);
    await userEvent.type(screen.getByPlaceholderText(/winter jacket/i), 'Offline Item');
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => screen.getByText('Offline Item'));

    // Come back online
    setOnline(true);
    syncPendingMutations.mockResolvedValue({ synced: 1, failed: 0 });
    // Also make the server return a fresh container post-sync
    api.containers.get.mockResolvedValue({
      ...CONTAINER,
      items: [...CONTAINER.items, { id: 999, name: 'Offline Item', quantity: 1, description: '', tags: '', container_id: 1 }],
    });

    // Click Sync now
    const syncButton = await screen.findByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    await waitFor(() => expect(syncPendingMutations).toHaveBeenCalled());
  });

  it('auto-syncs when coming back online', async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    api.containers.get.mockResolvedValue(CONTAINER);
    syncPendingMutations.mockResolvedValue({ synced: 0, failed: 0 });

    // Simulate coming back online
    await act(async () => setOnline(true));

    await waitFor(() => expect(syncPendingMutations).toHaveBeenCalled());
  });

  it('reloads from server after coming online', async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    const updatedContainer = {
      ...CONTAINER,
      items: [...CONTAINER.items, { id: 200, name: 'Fresh Item', quantity: 1, description: '', tags: '', container_id: 1 }],
    };
    api.containers.get.mockResolvedValue(updatedContainer);
    syncPendingMutations.mockResolvedValue({ synced: 0, failed: 0 });

    await act(async () => setOnline(true));

    await waitFor(() => expect(api.containers.get).toHaveBeenCalled());
  });
});

// ─── 5. Refresh / visibility ──────────────────────────────────────────────────

describe('Container page — refresh and visibility', () => {
  it('refetches from server when online and refresh is clicked', async () => {
    api.containers.get.mockResolvedValue(CONTAINER);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    api.containers.get.mockClear();
    fireEvent.click(screen.getByTitle('Refresh'));

    await waitFor(() => expect(api.containers.get).toHaveBeenCalledTimes(1));
  });

  it('loads from cache gracefully when offline and refresh is clicked', async () => {
    await setCachedContainer(CONTAINER);
    setOnline(false);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    // Click refresh — should still show cached data without error
    fireEvent.click(screen.getByTitle('Refresh'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tool Box' })).toBeInTheDocument());
    expect(api.containers.get).not.toHaveBeenCalled();
  });

  it('refetches when tab becomes visible while online', async () => {
    api.containers.get.mockResolvedValue(CONTAINER);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Tool Box' }));

    api.containers.get.mockClear();

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(api.containers.get).toHaveBeenCalledTimes(1));
  });
});
