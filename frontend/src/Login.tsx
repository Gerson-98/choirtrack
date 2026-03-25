import { useState } from 'react';
import api from './api';
import { LogIn } from 'lucide-react';

interface Props {
  onLogin: (token: string, role: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      onLogin(res.data.access_token, res.data.role);
    } catch {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ justifyContent: 'center', height: '100vh', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎵</div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '8px' }}>Coro</h1>
          <p style={{ color: 'var(--text-muted)' }}>Control de asistencia</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', background: 'rgba(255,65,108,0.1)', padding: '10px', borderRadius: '8px' }}>
              {error}
            </div>
          )}
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px' }}
          >
            <LogIn size={20} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}