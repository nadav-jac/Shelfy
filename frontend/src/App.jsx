import { Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import LocationDetailPage from './pages/LocationDetailPage.jsx';
import ContainerDetailPage from './pages/ContainerDetailPage.jsx';
import ScanContainerPage from './pages/ScanContainerPage.jsx';
import PrintContainerPage from './pages/PrintContainerPage.jsx';
import SearchPage from './pages/SearchPage.jsx';

function AppLayout() {
  return (
    <div className="app">
      <Navbar />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LocationsPage />} />
        <Route path="/locations/:id" element={<LocationDetailPage />} />
        <Route path="/containers/:id" element={<ContainerDetailPage />} />
        <Route path="/scan/container/:token" element={<ScanContainerPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      <Route path="/print/container/:token" element={<PrintContainerPage />} />
    </Routes>
  );
}
