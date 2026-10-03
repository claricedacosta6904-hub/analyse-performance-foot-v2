import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FootballBackdrop from './components/FootballBackdrop';
import Dashboard from './pages/Dashboard';
import ImportTeams from './pages/ImportTeams';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Standings from './pages/Standings';
import Matches from './pages/Matches';
import FormPage from './pages/FormPage';
import HomeStats from './pages/HomeStats';
import AwayStats from './pages/AwayStats';
import Analysis from './pages/Analysis';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="app-shell">
      <FootballBackdrop />
      <Sidebar />
      <main className="app-main">
        <Header />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ajouter-equipes" element={<ImportTeams />} />
          <Route path="/equipes" element={<Teams />} />
          <Route path="/equipes/:id" element={<TeamDetail />} />
          <Route path="/matchs" element={<Matches />} />
          <Route path="/classement" element={<Standings />} />
          <Route path="/forme" element={<FormPage />} />
          <Route path="/domicile" element={<HomeStats />} />
          <Route path="/exterieur" element={<AwayStats />} />
          <Route path="/analyse" element={<Analysis />} />
          <Route path="/parametres" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
