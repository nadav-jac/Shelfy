import { Link, NavLink } from 'react-router-dom';

function ShelfIcon() {
  return (
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="18" height="2.5" rx="1.25"/>
      <rect x="1" y="9" width="18" height="2.5" rx="1.25"/>
      <rect x="1" y="14" width="18" height="2.5" rx="1.25"/>
      <rect x="2" y="4" width="1.5" height="10" rx="0.75"/>
      <rect x="16.5" y="4" width="1.5" height="10" rx="0.75"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon"><ShelfIcon /></div>
          Shelfy
        </Link>
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          <HomeIcon /> Locations
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          <SearchIcon /> Search
        </NavLink>
      </div>
    </nav>
  );
}
