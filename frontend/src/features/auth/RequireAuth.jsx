import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { user, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (loading) return <main className="auth-loading"><span className="auth-spinner" /><p>Opening your workspace…</p></main>;
  if (sessionError) {
    return (
      <main className="auth-loading" role="alert">
        <p>{sessionError}</p>
        <button className="auth-session-retry" type="button" onClick={retrySession}>Retry connection</button>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
