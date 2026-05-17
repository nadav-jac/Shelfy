import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search(q);
      setResults(data);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search on mount if URL has query
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) doSearch(q);
    inputRef.current?.focus();
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(q ? { q } : {});
      doSearch(q);
    }, 300);
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    setSearchParams(query ? { q: query } : {});
    doSearch(query);
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Search Items</h1>
          <p>Find anything stored in your home</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="search-bar">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search by name, description, or tag…"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
              onClick={() => { setQuery(''); setResults([]); setSearched(false); setSearchParams({}); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      </form>

      {loading && <div className="loading">Searching…</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty">
          <div className="empty-icon">&#x1F50D;</div>
          <h3>No results for "{query}"</h3>
          <p>Try different keywords or check your spelling.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 14 }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for <strong>"{query}"</strong>
          </p>
          <div>
            {results.map((item) => (
              <div key={item.id} className="search-result">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                  <span style={{ fontSize: '0.78rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '999px', padding: '1px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    x{item.quantity}
                  </span>
                </div>
                {item.description && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>
                )}
                {item.tags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {item.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
                <div className="search-result-path">
                  <Link to={`/locations/${item.location_id}`}>{item.location_name}</Link>
                  <ChevronIcon />
                  <Link to={`/containers/${item.container_id}`}>{item.container_name}</Link>
                  <span style={{ marginLeft: 4, color: 'var(--border)' }}>({item.container_type})</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!searched && !loading && (
        <div className="empty" style={{ paddingTop: 24 }}>
          <div className="empty-icon">&#x1F50E;</div>
          <h3>What are you looking for?</h3>
          <p>Search across all your stored items.</p>
        </div>
      )}
    </main>
  );
}
