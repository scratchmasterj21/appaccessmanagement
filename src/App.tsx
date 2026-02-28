import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Global from './pages/Global';
import Apps from './pages/Apps';
import Users from './pages/Users';
import Layout from './components/Layout';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!user) {
    return (
      <div className="auth-gate">
        <h1>App Access Management</h1>
        <p>Sign in with your admin account to manage access rules.</p>
        <button type="button" onClick={signIn}>Sign in with Google</button>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <RequireAuth>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/global" replace />} />
          <Route path="/global" element={<Global />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<Navigate to="/global" replace />} />
        </Routes>
      </Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
