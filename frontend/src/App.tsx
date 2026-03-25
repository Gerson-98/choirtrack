import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './Login';
import Today from './Today';
import SessionPicker from './SessionPicker';
import Eligibility from './Eligibility';
import Dashboard from './Dashboard';
import Presentacion from './Presentacion';

const VALID_ROLES = ['director', 'oraciones', 'repasos'];

function TodayWrapper({ onLogout, userRole }: { onLogout: () => void; userRole: string }) {
  const { sessionType } = useParams<{ sessionType: string }>();
  const navigate = useNavigate();
  // oraciones y director tienen pantalla anterior (SessionPicker o Dashboard); repasos no
  const onBack = userRole !== 'repasos' ? () => navigate('/') : undefined;
  return <Today role={sessionType ?? 'am_prayer'} onLogout={onLogout} onBack={onBack} />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    if (token) {
      if (savedRole && VALID_ROLES.includes(savedRole)) {
        setIsAuthenticated(true);
        setRole(savedRole);
      } else {
        // Token existente pero role inválido — limpiar todo
        localStorage.removeItem('token');
        localStorage.removeItem('role');
      }
    }
  }, []);

  const handleLogin = (token: string, userRole: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', userRole);
    setIsAuthenticated(true);
    setRole(userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setRole('');
  };

  const HomeComponent = () => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (role === 'director') return <Dashboard onLogout={handleLogout} />;
    if (role === 'oraciones') return <SessionPicker onLogout={handleLogout} />;
    if (role === 'repasos') return <Today role="rehearsal" onLogout={handleLogout} />;
    return <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
        />
        <Route path="/" element={<HomeComponent />} />
        <Route
          path="/session/:sessionType"
          element={
            isAuthenticated
              ? <TodayWrapper onLogout={handleLogout} userRole={role} />
              : <Navigate to="/login" />
          }
        />
        <Route
          path="/eligibility"
          element={isAuthenticated ? <Eligibility onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/presentacion"
          element={isAuthenticated ? <Presentacion /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
