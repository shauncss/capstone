import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminLogin } from '../services/api';
import '../styles/auth.css';

function AdminSignIn({ onAuthed }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/admin';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    setSubmitting(true);
    try {
      await adminLogin({ username: username.trim(), password });
      onAuthed?.();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || 'Invalid credentials';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card auth-card">
      <h2>Admin sign-in</h2>
      <p className="helper-text">Dev-only gate for admin tools. Patients do not need to sign in.</p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label className="full-width">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
            autoFocus
          />
        </label>
        <label className="full-width">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="full-width auth-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/')}
            disabled={submitting}
          >
            Back to patient
          </button>
        </div>
      </form>
    </section>
  );
}

export default AdminSignIn;
