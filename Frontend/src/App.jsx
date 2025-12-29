import { useEffect, useState } from 'react';
import { Link, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import PatientCheckIn from './pages/PatientCheckIn';
import AdminDashboard from './pages/AdminDashboard';
import DisplayBoard from './pages/DisplayBoard';
import AdminSignIn from './pages/AdminSignIn';

const DEV_NAV_SESSION_KEY = 'clinic:dev-nav-session';
const DEV_ADMIN_AUTH_KEY = 'clinic:dev-admin-auth';
const ENV_FORCED_DEV_NAV = import.meta.env.VITE_SHOW_DEV_NAV === 'true';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const getInitialDevNav = () => {
    if (ENV_FORCED_DEV_NAV) {
      return true;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    return window.sessionStorage.getItem(DEV_NAV_SESSION_KEY) === 'true';
  };
  const [devNavEnabled, setDevNavEnabled] = useState(() => getInitialDevNav());
  const [adminAuthed, setAdminAuthed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!getInitialDevNav()) return false;
    return window.sessionStorage.getItem(DEV_ADMIN_AUTH_KEY) === 'true';
  });

  useEffect(() => {
    if (ENV_FORCED_DEV_NAV) {
      setDevNavEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || ENV_FORCED_DEV_NAV) return;
    if (devNavEnabled) {
      window.sessionStorage.setItem(DEV_NAV_SESSION_KEY, 'true');
    } else {
      window.sessionStorage.removeItem(DEV_NAV_SESSION_KEY);
      window.sessionStorage.removeItem(DEV_ADMIN_AUTH_KEY);
    }
  }, [devNavEnabled, ENV_FORCED_DEV_NAV]);

  useEffect(() => {
    if (ENV_FORCED_DEV_NAV) return;
    const params = new URLSearchParams(location.search);
    if (params.get('dev') === '1') {
      setDevNavEnabled(true);
    } else if (params.get('dev') === '0') {
      setDevNavEnabled(false);
      setAdminAuthed(false);
    }
  }, [location.search, ENV_FORCED_DEV_NAV]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!devNavEnabled) {
      setAdminAuthed(false);
      window.sessionStorage.removeItem(DEV_ADMIN_AUTH_KEY);
      return;
    }
    if (adminAuthed) {
      window.sessionStorage.setItem(DEV_ADMIN_AUTH_KEY, 'true');
    } else {
      window.sessionStorage.removeItem(DEV_ADMIN_AUTH_KEY);
    }
  }, [adminAuthed, devNavEnabled]);

  const handleSignOut = () => {
    setAdminAuthed(false);
    navigate('/');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Clinic Self Check-In</h1>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Patient</Link>
          <Link to="/display" className={location.pathname === '/display' ? 'active' : ''}>Display</Link>
          {devNavEnabled && (
            <Link
              to={adminAuthed ? '/admin' : '/admin/login'}
              className={location.pathname.startsWith('/admin') ? 'active' : ''}
            >
              Admin
            </Link>
          )}
          {devNavEnabled && adminAuthed && (
            <button type="button" className="ghost-button" style={{ width: 'auto' }} onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PatientCheckIn />} />
          <Route
            path="/admin"
            element={devNavEnabled && adminAuthed
              ? <AdminDashboard />
              : <Navigate to="/admin/login" replace state={{ from: location.pathname }} />} />
          <Route
            path="/admin/login"
            element={devNavEnabled ? (
              <AdminSignIn
                onAuthed={() => setAdminAuthed(true)}
              />
            ) : <Navigate to="/" replace />}
          />
          <Route path="/display" element={<DisplayBoard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
