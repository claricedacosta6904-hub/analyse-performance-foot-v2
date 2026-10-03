import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ListOrdered,
  Activity,
  Home,
  Plane,
  BarChart3,
  Settings,
} from 'lucide-react';
import { NAV_ITEMS } from '../data/config';

const ICONS = {
  accueil: LayoutDashboard,
  equipes: Users,
  matchs: CalendarDays,
  classement: ListOrdered,
  forme: Activity,
  domicile: Home,
  exterieur: Plane,
  analyse: BarChart3,
  parametres: Settings,
};

export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">⚽</span>
        <div>
          <div className="sidebar-brand-title">ANALYSE</div>
          <div className="sidebar-brand-subtitle">PERFORMANCE FOOT</div>
        </div>
      </div>

      <div className="sidebar-links">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-w);
          flex-shrink: 0;
          background: var(--bg-elevated);
          border-right: 1px solid var(--card-border);
          padding: 22px 14px;
          display: flex;
          flex-direction: column;
          gap: 26px;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 2;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
        }
        .sidebar-brand-mark {
          font-size: 1.3rem;
        }
        .sidebar-brand-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.86rem;
          letter-spacing: 0.02em;
        }
        .sidebar-brand-subtitle {
          font-size: 0.62rem;
          color: var(--text-faint);
          letter-spacing: 0.04em;
        }
        .sidebar-links {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border-radius: 10px;
          color: var(--text-dim);
          font-size: 0.87rem;
          font-weight: 500;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .sidebar-link:hover {
          background: rgba(255,255,255,0.03);
          color: var(--text);
        }
        .sidebar-link.active {
          background: var(--accent-soft);
          color: var(--accent-strong);
        }

        @media (max-width: 900px) {
          .sidebar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: auto;
            height: auto;
            width: 100%;
            flex-direction: row;
            overflow-x: auto;
            padding: 8px 10px;
            border-right: none;
            border-top: 1px solid var(--card-border);
            gap: 0;
            z-index: 20;
          }
          .sidebar-brand { display: none; }
          .sidebar-links {
            flex-direction: row;
            width: 100%;
            justify-content: space-between;
          }
          .sidebar-link {
            flex-direction: column;
            gap: 3px;
            font-size: 0.6rem;
            padding: 6px 8px;
            white-space: nowrap;
          }
        }
      `}</style>
    </nav>
  );
}
