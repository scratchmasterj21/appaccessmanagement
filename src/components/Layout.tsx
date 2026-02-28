import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="layout">
      <header className="layout-header">
        <nav className="layout-nav">
          <NavLink to="/global" className={({ isActive }) => isActive ? 'active' : ''}>Global</NavLink>
          <NavLink to="/apps" className={({ isActive }) => isActive ? 'active' : ''}>Apps</NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>Users</NavLink>
        </nav>
        <div className="layout-user">
          <span>{user?.email}</span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="layout-main">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
