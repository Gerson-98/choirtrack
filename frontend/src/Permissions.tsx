import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, LogOut, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { toLocalDateString } from './utils';

interface Member {
  id: number;
  name: string;
  voice: string;
}

interface Permission {
  id: number;
  memberId: number;
  member: { id: number; name: string; voice: string };
  sessionType: string;
  weekStart: string;
  reason: string | null;
  grantedBy: string;
  createdAt: string;
}

interface Props {
  onLogout: () => void;
}

const SESSION_LABELS: Record<string, string> = {
  am_prayer: '🌅 Oración 5am',
  pm_prayer: '🌙 Oración 6pm',
  morning_prayer: '☀️ Oración 9am',
  rehearsal: '🎵 Ensayo',
};

const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];

function getWeekSunday(ref: Date): Date {
  return startOfWeek(ref, { weekStartsOn: 0 });
}

export default function Permissions({ onLogout }: Props) {
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekRef, setWeekRef] = useState<Date>(new Date());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    memberId: 0,
    sessionType: 'rehearsal',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const weekStart = getWeekSunday(weekRef);
  const weekEnd = endOfWeek(weekRef, { weekStartsOn: 0 });
  const weekStartStr = toLocalDateString(weekStart);
  const weekLabel = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;

  const today = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isCurrentOrFuture = weekStart.getTime() >= today.getTime();

  async function loadData() {
    setLoading(true);
    try {
      const [permsRes, membersRes] = await Promise.all([
        api.get(`/permissions?weekStart=${weekStartStr}`),
        api.get('/members'),
      ]);
      setPermissions(permsRes.data);
      setMembers(membersRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [weekStartStr]);

  const goPrevWeek = () => setWeekRef(w => subWeeks(w, 1));
  const goNextWeek = () => {
    if (!isCurrentOrFuture) setWeekRef(w => addWeeks(w, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId) { setFormError('Selecciona un miembro.'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/permissions', {
        memberId: form.memberId,
        sessionType: form.sessionType,
        weekStart: weekStartStr,
        reason: form.reason || undefined,
      });
      setShowForm(false);
      setForm({ memberId: 0, sessionType: 'rehearsal', reason: '' });
      await loadData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Error al guardar el permiso.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este permiso?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/permissions/${id}`);
      setPermissions(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  // Ordenar miembros por voz
  const sortedMembers = [...members].sort((a, b) => {
    const vi = VOICE_ORDER.indexOf(a.voice);
    const vj = VOICE_ORDER.indexOf(b.voice);
    if (vi !== vj) return (vi === -1 ? 99 : vi) - (vj === -1 ? 99 : vj);
    return a.name.localeCompare(b.name, 'es');
  });

  return (
    <>
      {/* Header */}
      <div className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowLeft
            size={22} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
            onClick={() => navigate(-1)}
          />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>✋ Permisos de ausencia</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Semana {weekLabel}</p>
          </div>
        </div>
        <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
      </div>

      {/* Navegación de semana */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--card-border)',
        background: 'var(--bg-base)',
      }}>
        <button
          onClick={goPrevWeek}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {weekLabel}
        </span>
        <button
          onClick={goNextWeek}
          disabled={isCurrentOrFuture}
          style={{
            background: 'none', border: 'none',
            cursor: isCurrentOrFuture ? 'default' : 'pointer',
            color: isCurrentOrFuture ? '#D1D5DB' : 'var(--text-muted)',
            padding: '4px',
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="container" style={{ paddingBottom: '100px', paddingTop: '12px' }}>
        {/* Botón nuevo permiso */}
        <button
          onClick={() => { setShowForm(p => !p); setFormError(null); }}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px',
            background: showForm ? '#F0EEF8' : 'var(--accent-primary)',
            border: showForm ? '1px solid #E5E7EB' : 'none',
            color: showForm ? 'var(--text-muted)' : '#fff',
            fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          {showForm ? 'Cancelar' : '＋ Dar permiso'}
        </button>

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit}>
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nuevo permiso — semana {weekLabel}
              </p>

              {/* Miembro */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Miembro *
                </label>
                <select
                  value={form.memberId}
                  onChange={e => setForm(f => ({ ...f, memberId: Number(e.target.value) }))}
                  required
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid var(--card-border)', fontSize: '0.9rem',
                    background: '#FAFAFA', color: 'var(--text-main)', fontFamily: 'inherit',
                  }}
                >
                  <option value={0} disabled>Seleccionar miembro…</option>
                  {sortedMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de sesión */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Tipo de sesión
                </label>
                <select
                  value={form.sessionType}
                  onChange={e => setForm(f => ({ ...f, sessionType: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid var(--card-border)', fontSize: '0.9rem',
                    background: '#FAFAFA', color: 'var(--text-main)', fontFamily: 'inherit',
                  }}
                >
                  <option value="rehearsal">🎵 Ensayo</option>
                  <option value="am_prayer">🌅 Oración 5am</option>
                  <option value="pm_prayer">🌙 Oración 6pm</option>
                  <option value="morning_prayer">☀️ Oración 9am</option>
                </select>
              </div>

              {/* Motivo */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Motivo (opcional)
                </label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Ej. Viaje, enfermedad…"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid var(--card-border)', fontSize: '0.9rem',
                    background: '#FAFAFA', color: 'var(--text-main)', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {formError && (
                <p style={{ fontSize: '0.82rem', color: '#DC2626', marginBottom: '10px' }}>
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '11px', borderRadius: '8px',
                  background: 'var(--accent-primary)', border: 'none',
                  color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Guardando…' : 'Guardar permiso'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de permisos */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: '0.9rem' }}>
            Cargando…
          </p>
        ) : permissions.length === 0 ? (
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No hay permisos para esta semana.
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {permissions.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderTop: idx > 0 ? '1px solid #F0F0F0' : 'none',
                  background: '#FAFAFA',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {p.member.name}
                    </span>
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
                      background: 'rgba(108,99,255,0.1)', color: 'var(--accent-primary)',
                      fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {SESSION_LABELS[p.sessionType] ?? p.sessionType}
                    </span>
                  </div>
                  {p.reason && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {p.reason}
                    </p>
                  )}
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Dado por {p.grantedBy}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#EF4444', padding: '4px', flexShrink: 0, marginLeft: '8px',
                    opacity: deletingId === p.id ? 0.4 : 1,
                  }}
                  title="Eliminar permiso"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
