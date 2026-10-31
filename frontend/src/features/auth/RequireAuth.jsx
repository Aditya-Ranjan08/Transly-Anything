import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <main className="auth-loading"><span className="auth-spinner" /><p>Opening your workspace…</p></main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
