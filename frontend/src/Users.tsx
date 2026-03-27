import { useState, useEffect } from 'react';
import { LogOut, Pencil, Trash2, KeyRound, UserPlus, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './api';

interface User {
  id: number;
  username: string;
  role: string;
}

interface Props {
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  oraciones: 'Oraciones',
  repasos: 'Repasos',
};

const VALID_ROLES = ['oraciones', 'repasos', 'director'];

function getCurrentUserId(): number | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export default function Users({ onLogout }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nuevo usuario
  const [showNew, setShowNew] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('oraciones');
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Editar usuario
  const [editId, setEditId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Cambiar contraseña
  const [pwdId, setPwdId] = useState<number | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Eliminar
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentUserId = getCurrentUserId();
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword.trim()) {
      setNewError('Username y contraseña son requeridos.');
      return;
    }
    setNewSaving(true);
    setNewError(null);
    try {
      await api.post('/users', { username: newUsername.trim(), password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('oraciones');
      setShowNew(false);
      await loadUsers();
    } catch (e: any) {
      setNewError(e?.response?.data?.message ?? 'Error al crear usuario.');
    } finally {
      setNewSaving(false);
    }
  }

  function startEdit(user: User) {
    setEditId(user.id);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditError(null);
    setPwdId(null);
    setDeleteId(null);
  }

  async function handleEdit() {
    if (!editUsername.trim()) {
      setEditError('El username no puede estar vacío.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.patch(`/users/${editId}`, { username: editUsername.trim(), role: editRole });
      setEditId(null);
      await loadUsers();
    } catch (e: any) {
      setEditError(e?.response?.data?.message ?? 'Error al guardar cambios.');
    } finally {
      setEditSaving(false);
    }
  }

  function startPwd(userId: number) {
    setPwdId(userId);
    setPwdValue('');
    setPwdError(null);
    setEditId(null);
    setDeleteId(null);
  }

  async function handlePwd() {
    if (!pwdValue.trim()) {
      setPwdError('La contraseña no puede estar vacía.');
      return;
    }
    setPwdSaving(true);
    setPwdError(null);
    try {
      await api.patch(`/users/${pwdId}/password`, { newPassword: pwdValue });
      setPwdId(null);
    } catch (e: any) {
      setPwdError(e?.response?.data?.message ?? 'Error al cambiar contraseña.');
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteSaving(true);
    setDeleteError(null);
    try {
      await api.delete(`/users/${deleteId}`);
      setDeleteId(null);
      await loadUsers();
    } catch (e: any) {
      setDeleteError(e?.response?.data?.message ?? 'Error al eliminar usuario.');
    } finally {
      setDeleteSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid var(--card-border)', background: '#F9F9FB',
    fontSize: '0.9rem', color: 'var(--text-main)', outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: '8px',
    background: 'var(--accent-primary)', border: 'none',
    color: '#fff', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '8px',
    background: '#F0EEF8', border: '1px solid #E5E7EB',
    color: 'var(--text-muted)', fontSize: '0.88rem', cursor: 'pointer',
  };

  return (
    <>
      {/* Header */}
      <div className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '1.4rem', padding: 0,
            }}
            aria-label="Volver"
          >
            ←
          </button>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>👥 Usuarios</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Gestión de cuentas</p>
          </div>
        </div>
        <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
      </div>

      <div className="container" style={{ paddingBottom: '24px', paddingTop: '12px' }}>

        {/* Botón nuevo usuario */}
        {!showNew && (
          <button
            onClick={() => { setShowNew(true); setNewError(null); }}
            style={{
              ...btnPrimary,
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '16px', padding: '10px 18px',
            }}
          >
            <UserPlus size={16} /> Nuevo usuario
          </button>
        )}

        {/* Formulario nuevo usuario */}
        {showNew && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px' }}>Nuevo usuario</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                style={inputStyle}
                placeholder="Username"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                autoFocus
              />
              <input
                style={inputStyle}
                type="password"
                placeholder="Contraseña"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <select style={selectStyle} value={newRole} onChange={e => setNewRole(e.target.value)}>
                {VALID_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {newError && (
                <p style={{ fontSize: '0.82rem', color: '#DC2626', margin: 0 }}>{newError}</p>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => { setShowNew(false); setNewError(null); }}
                  style={btnSecondary}
                >
                  Cancelar
                </button>
                <button onClick={handleCreate} disabled={newSaving} style={btnPrimary}>
                  {newSaving ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estado de carga y error global */}
        {loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando…</p>
        )}
        {error && (
          <p style={{ color: '#DC2626', fontSize: '0.9rem' }}>{error}</p>
        )}

        {/* Lista de usuarios */}
        {!loading && users.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay usuarios.</p>
        )}

        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const isEditing = editId === user.id;
          const isChangingPwd = pwdId === user.id;
          const isDeleting = deleteId === user.id;

          return (
            <div key={user.id} className="glass-panel" style={{ padding: '14px 16px', marginBottom: '10px' }}>

              {/* Fila principal */}
              {!isEditing && !isChangingPwd && !isDeleting && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.97rem', margin: 0 }}>
                      {user.username}
                      {isCurrentUser && (
                        <span style={{
                          marginLeft: '8px', fontSize: '0.65rem', padding: '2px 7px',
                          borderRadius: '10px', background: 'rgba(108,99,255,0.12)',
                          color: 'var(--accent-primary)', fontWeight: 600,
                        }}>
                          tú
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => startEdit(user)}
                      title="Editar"
                      style={{
                        background: '#F0EEF8', border: '1px solid #E5E7EB',
                        borderRadius: '8px', padding: '7px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Pencil size={15} color="var(--text-muted)" />
                    </button>
                    <button
                      onClick={() => startPwd(user.id)}
                      title="Cambiar contraseña"
                      style={{
                        background: '#F0EEF8', border: '1px solid #E5E7EB',
                        borderRadius: '8px', padding: '7px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <KeyRound size={15} color="var(--text-muted)" />
                    </button>
                    <button
                      onClick={() => { if (!isCurrentUser) { setDeleteId(user.id); setDeleteError(null); setEditId(null); setPwdId(null); } }}
                      title={isCurrentUser ? 'No puedes eliminar tu propio usuario' : 'Eliminar'}
                      disabled={isCurrentUser}
                      style={{
                        background: isCurrentUser ? '#F5F5F5' : '#FEF2F2',
                        border: `1px solid ${isCurrentUser ? '#E5E7EB' : '#FECACA'}`,
                        borderRadius: '8px', padding: '7px',
                        cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center',
                        opacity: isCurrentUser ? 0.4 : 1,
                      }}
                    >
                      <Trash2 size={15} color={isCurrentUser ? 'var(--text-muted)' : '#DC2626'} />
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario editar */}
              {isEditing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                    Editando: {user.username}
                  </p>
                  <input
                    style={inputStyle}
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    autoFocus
                  />
                  <select style={selectStyle} value={editRole} onChange={e => setEditRole(e.target.value)}>
                    {VALID_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  {editError && <p style={{ fontSize: '0.82rem', color: '#DC2626', margin: 0 }}>{editError}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setEditId(null)} style={btnSecondary}>
                      <X size={14} style={{ verticalAlign: 'middle' }} /> Cancelar
                    </button>
                    <button onClick={handleEdit} disabled={editSaving} style={btnPrimary}>
                      <Check size={14} style={{ verticalAlign: 'middle' }} /> {editSaving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cambiar contraseña */}
              {isChangingPwd && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                    🔑 Nueva contraseña para: {user.username}
                  </p>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="Nueva contraseña"
                    value={pwdValue}
                    onChange={e => setPwdValue(e.target.value)}
                    autoFocus
                  />
                  {pwdError && <p style={{ fontSize: '0.82rem', color: '#DC2626', margin: 0 }}>{pwdError}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setPwdId(null)} style={btnSecondary}>
                      <X size={14} style={{ verticalAlign: 'middle' }} /> Cancelar
                    </button>
                    <button onClick={handlePwd} disabled={pwdSaving} style={btnPrimary}>
                      <Check size={14} style={{ verticalAlign: 'middle' }} /> {pwdSaving ? 'Cambiando…' : 'Cambiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmar eliminación */}
              {isDeleting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.92rem', color: '#DC2626', margin: 0 }}>
                    ¿Eliminar a <strong>{user.username}</strong>?
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                    Esta acción no se puede deshacer.
                  </p>
                  {deleteError && <p style={{ fontSize: '0.82rem', color: '#DC2626', margin: 0 }}>{deleteError}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setDeleteId(null)} style={btnSecondary}>
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteSaving}
                      style={{
                        ...btnPrimary,
                        background: '#DC2626',
                      }}
                    >
                      {deleteSaving ? 'Eliminando…' : '🗑️ Eliminar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
