import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import LocationDetailPage from './pages/LocationDetailPage.jsx';
import ContainerDetailPage from './pages/ContainerDetailPage.jsx';
import ScanContainerPage from './pages/ScanContainerPage.jsx';
import SearchPage from './pages/SearchPage.jsx';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <Routes>
        <Route path="/" element={<LocationsPage />} />
        <Route path="/locations/:id" element={<LocationDetailPage />} />
        <Route path="/containers/:id" element={<ContainerDetailPage />} />
        <Route path="/scan/container/:token" element={<ScanContainerPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </div>
  );
}
