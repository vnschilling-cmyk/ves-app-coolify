import { useState } from 'react';
import { useUsers } from '../context/UserContext';
import { LogIn } from 'lucide-react';
import vesLogo from '../assets/app-logo.png'; // Updated filename

const LoginScreen = () => {
  const { login } = useUsers();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identity || !password) return;

    setLoading(true);
    setError('');

    const success = await login(identity, password);
    if (!success) {
      setError('Anmeldung fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.');
      setLoading(false);
    }
    // If success, the App component will automatically switch views
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <img src={vesLogo} alt="VES CNC Logo" className="login-logo" />
        </div>

        <h2>Willkommen</h2>
        <p className="subtitle">Bitte melden Sie sich an</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Benutzername oder Email</label>
            <input
              type="text"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="max / admin@ves-app.de"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Anmelden...' : <><LogIn size={20} /> Anmelden</>}
          </button>
        </form>
      </div>

      <style>{`
        .login-container {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-background);
          background-image: 
            radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.1) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
        }

        .login-card {
          background: white;
          padding: 3rem;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          width: 100%;
          max-width: 420px;
          text-align: center;
        }

        .login-logo {
          height: 60px;
          margin-bottom: 1.5rem;
          object-fit: contain;
        }

        h2 {
          font-size: 1.8rem;
          margin: 0;
          color: var(--color-text-main);
        }

        .subtitle {
          color: var(--color-text-muted);
          margin-top: 0.5rem;
          margin-bottom: 2rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }

        .form-group {
          text-align: left;
        }

        .form-group label {
          display: block;
          font-size: 0.9rem;
          color: var(--color-text-main);
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .form-group input:focus {
          border-color: var(--color-primary);
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .error-message {
          color: #ef4444;
          font-size: 0.9rem;
          background: #fef2f2;
          padding: 0.75rem;
          border-radius: 8px;
        }

        .login-btn {
          margin-top: 0.5rem;
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s;
        }

        .login-btn:hover {
          background: #1d4ed8;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
