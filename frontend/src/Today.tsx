import { useState, useEffect } from 'react';
import { format, addDays, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Circle, Star, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { toLocalDateString, toGuatemalaTime } from './utils';

interface Member {
  id: number;
  name: string;
  gender: string;
  voice: string;
}

interface Props {
  role: string;
  onLogout: () => void;
  onBack?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  am_prayer: 'Oración 5am',
  pm_prayer: 'Oración 6pm',
  rehearsal: 'Ensayo',
};

const ROLE_EMOJI: Record<string, string> = {
  am_prayer: '🌅',
  pm_prayer: '🌙',
  rehearsal: '🎵',
};

const VOICE_LABELS: Record<string, string> = {
  soprano: 'Sopranos',
  segunda: 'Segundas',
  tenores: 'Tenores',
  tenor: 'Tenores',
  bajo: 'Bajos',
};

const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];

const VOICE_COLORS: Record<string, { pill: string; text: string; border: string }> = {
  soprano: { pill: 'rgba(212,112,176,0.15)', text: '#d470b0', border: 'rgba(212,112,176,0.3)' },
  segunda: { pill: 'rgba(56,139,235,0.15)', text: '#4a9ef5', border: 'rgba(56,139,235,0.3)' },
  tenor: { pill: 'rgba(50,200,140,0.15)', text: '#32c88c', border: 'rgba(50,200,140,0.3)' },
  bajo: { pill: 'rgba(240,180,80,0.15)', text: '#f0b450', border: 'rgba(240,180,80,0.3)' },
};

function getWeekDays(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const sunday = subDays(referenceDate, day);
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

function getAllowedDays(role: string, weekDays: Date[]): Date[] {
  if (role === 'rehearsal') {
    return weekDays.filter(d => [1, 3, 6].includes(d.getDay()));
  }
  return weekDays;
}

/** Decodifica el payload del JWT para obtener el username sin verificar firma */
function getUsernameFromToken(): string {
  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username ?? '';
  } catch {
    return '';
  }
}

type Screen = 'list' | 'confirm' | 'success';

export default function Today({ role, onLogout, onBack }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('list');
  const [openVoices, setOpenVoices] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [sessionUpdatedAt, setSessionUpdatedAt] = useState<string | null>(null);
  const navigate = useNavigate();

  const userRole = localStorage.getItem('role') ?? '';
  const isDirector = userRole === 'director';

  const weekDays = getWeekDays(selectedDate);
  const allowedDays = getAllowedDays(role, weekDays);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  async function loadData(date: Date) {
    setLoading(true);
    setScreen('list');
    setAlreadySaved(false);
    setLastSavedBy(null);
    setSessionUpdatedAt(null);
    try {
      const dateStr = toLocalDateString(date);
      const [membersRes, sessionRes] = await Promise.all([
        api.get('/members'),
        api.get(`/sessions/date/${dateStr}?type=${role}`),
      ]);

      setMembers(membersRes.data);
      setSessionId(sessionRes.data.id);

      const presentIds = new Set<number>(
        sessionRes.data.attendances
          .filter((a: any) => a.isPresent)
          .map((a: any) => a.memberId as number),
      );
      setSelected(presentIds);

      // Activar alreadySaved si ya hay registros presentes
      if (presentIds.size > 0) setAlreadySaved(true);

      // Cargar metadatos de última actualización
      if (sessionRes.data.lastSavedBy) setLastSavedBy(sessionRes.data.lastSavedBy);
      if (sessionRes.data.updatedAt) setSessionUpdatedAt(sessionRes.data.updatedAt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const toggleMember = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVoice = (voice: string) => {
    setOpenVoices(prev => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  };

  const handleSave = async () => {
    if (!sessionId) {
      setSaveError('No se pudo obtener la sesión. Recarga la página.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.post('/attendance/save', {
        sessionId,
        presentMemberIds: Array.from(selected),
      });
      setScreen('success');
      setAlreadySaved(true);
      setLastSavedBy(getUsernameFromToken());
      setSessionUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      console.error(e);
      setSaveError(e?.response?.data?.message ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const byVoice: Record<string, Member[]> = {};
  for (const voice of VOICE_ORDER) byVoice[voice] = [];
  for (const m of members) {
    const v = m.voice in byVoice ? m.voice : 'soprano';
    byVoice[v].push(m);
  }

  const roleName = ROLE_LABELS[role] ?? role;
  const roleEmoji = ROLE_EMOJI[role] ?? '📋';
  const fechaDisplay = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
  const presentCount = selected.size;

  const canGoPrev = allowedDays.length > 0 && selectedDate > allowedDays[0];
  const canGoNext = allowedDays.length > 0 && selectedDate < allowedDays[allowedDays.length - 1];

  const goPrevDay = () => {
    const idx = allowedDays.findIndex(d => d.getTime() === selectedDate.getTime());
    if (idx > 0) setSelectedDate(allowedDays[idx - 1]);
  };

  const goNextDay = () => {
    const idx = allowedDays.findIndex(d => d.getTime() === selectedDate.getTime());
    if (idx < allowedDays.length - 1) setSelectedDate(allowedDays[idx + 1]);
  };

  // Botón ← reutilizable en todos los headers
  const BackButton = () => onBack ? (
    <button
      onClick={onBack}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        minWidth: '44px', minHeight: '44px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: '1.4rem',
        flexShrink: 0, padding: 0,
      }}
      aria-label="Volver"
    >
      ←
    </button>
  ) : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      </div>
    );
  }

  // ── PANTALLA DE CONFIRMACIÓN ──────────────────────────────
  if (screen === 'confirm') {
    const presentMembers = members.filter(m => selected.has(m.id));
    const byVoicePresent: Record<string, Member[]> = {};
    for (const voice of VOICE_ORDER) byVoicePresent[voice] = [];
    for (const m of presentMembers) {
      const v = m.voice in byVoicePresent ? m.voice : 'soprano';
      byVoicePresent[v].push(m);
    }

    return (
      <>
        <div className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BackButton />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Confirmar asistencia</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {roleEmoji} {roleName} · {fechaDisplay}
              </p>
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingBottom: '100px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              ¿Guardar {presentCount} presente{presentCount !== 1 ? 's' : ''}?
            </p>

            {VOICE_ORDER.map(voice => {
              const list = byVoicePresent[voice];
              if (!list.length) return null;
              const vc = VOICE_COLORS[voice];
              return (
                <div key={voice} style={{ marginBottom: '12px' }}>
                  <p style={{
                    fontSize: '0.75rem', fontWeight: 600, color: vc.text,
                    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {VOICE_LABELS[voice] ?? voice}
                  </p>
                  {list.map(m => (
                    <div key={m.id} style={{
                      padding: '7px 10px', borderRadius: '8px',
                      background: '#F9F9FB', marginBottom: '4px',
                      fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <CheckCircle2 size={16} color="var(--accent-primary)" />
                      {m.name}
                    </div>
                  ))}
                </div>
              );
            })}

            {presentCount === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '12px 0' }}>
                No hay nadie marcado — todos quedarán como ausentes.
              </p>
            )}

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
              Los demás ({members.length - presentCount}) quedarán como ausentes.
            </p>
          </div>
        </div>

        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '430px', padding: '12px 16px',
          background: 'rgba(255,255,255,0.97)', borderTop: '1px solid var(--card-border)',
          display: 'flex', gap: '10px', backdropFilter: 'blur(8px)', zIndex: 20,
        }}>
          <button
            onClick={() => setScreen('list')}
            style={{
              flex: 1, padding: '13px', borderRadius: '10px',
              background: '#F0EEF8', border: '1px solid #E5E7EB',
              color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            Volver
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '13px', borderRadius: '10px',
              background: 'var(--accent-primary)', border: 'none',
              color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Sí, guardar ✓'}
          </button>
        </div>
        {saveError && (
          <div style={{
            position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)', maxWidth: '398px',
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
            padding: '10px 14px', fontSize: '0.85rem', color: '#DC2626', zIndex: 21,
          }}>
            {saveError}
          </div>
        )}
      </>
    );
  }

  // ── PANTALLA DE ÉXITO ─────────────────────────────────────
  if (screen === 'success') {
    return (
      <>
        <div className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BackButton />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{roleEmoji} {roleName}</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{fechaDisplay}</p>
            </div>
          </div>
          <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '70vh', gap: '16px', padding: '0 32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--success)' }}>¡Asistencia guardada!</h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
            {presentCount} presente{presentCount !== 1 ? 's' : ''} registrado{presentCount !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Puedes volver a este día para corregir
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', width: '100%', maxWidth: '300px' }}>
            <button
              onClick={() => setScreen('list')}
              style={{
                flex: 2, padding: '12px 0', borderRadius: '10px',
                background: '#6C63FF', border: 'none',
                color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Editar lista
            </button>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: '10px',
                  background: '#F0EEF8', border: '1px solid #E5E7EB',
                  color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer',
                }}
              >
                ← Volver
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── PANTALLA PRINCIPAL: LISTA ─────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <BackButton />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{roleEmoji} {roleName}</h2>
              {isDirector && (
                <span style={{
                  fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px',
                  background: 'rgba(108,99,255,0.12)', color: 'var(--accent-primary)',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  👁 Vista director
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {fechaDisplay}
            </p>
            {lastSavedBy && sessionUpdatedAt && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Actualizado por {lastSavedBy} · {toGuatemalaTime(sessionUpdatedAt)}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
          <div className="count-badge">{presentCount} / {members.length}</div>
          <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
        </div>
      </div>

      {/* Navegación de días */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--card-border)',
        background: 'var(--bg-base)',
      }}>
        <button
          onClick={goPrevDay}
          disabled={!canGoPrev}
          style={{
            background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default',
            color: canGoPrev ? 'var(--text-muted)' : '#D1D5DB', padding: '4px',
          }}
        >
          <ChevronLeft size={22} />
        </button>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {allowedDays.map(d => {
            const isSelected = d.getTime() === selectedDate.getTime();
            const isToday = d.getTime() === startOfDay(new Date()).getTime();
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                style={{
                  padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? 'var(--accent-primary)' : '#EEEDF6',
                  border: isToday && !isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {format(d, 'EEE d', { locale: es })}
              </button>
            );
          })}
        </div>

        <button
          onClick={goNextDay}
          disabled={!canGoNext}
          style={{
            background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default',
            color: canGoNext ? 'var(--text-muted)' : '#D1D5DB', padding: '4px',
          }}
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Lista de miembros por voz */}
      <div className="container" style={{ paddingBottom: '100px', paddingTop: '8px' }}>
        {VOICE_ORDER.map(voice => {
          const list = byVoice[voice];
          if (!list.length) return null;
          const isOpen = openVoices.has(voice);
          const presentInVoice = list.filter(m => selected.has(m.id)).length;
          const vc = VOICE_COLORS[voice];

          return (
            <div key={voice} style={{ marginBottom: '8px' }}>
              <div
                onClick={() => toggleVoice(voice)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', background: '#F9F9FB',
                  borderRadius: isOpen ? '10px 10px 0 0' : '10px',
                  border: `1px solid ${vc.border}`,
                  borderBottom: isOpen ? `1px solid ${vc.border}` : undefined,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, color: vc.text, fontSize: '0.95rem' }}>
                  {VOICE_LABELS[voice] ?? voice}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {presentInVoice}/{list.length}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div style={{
                  border: `1px solid ${vc.border}`, borderTop: 'none',
                  borderRadius: '0 0 10px 10px', overflow: 'hidden',
                }}>
                  {list.map((member, idx) => {
                    const isPresent = selected.has(member.id);
                    const initials = member.name.split(' ').slice(0, 2).map(n => n[0]).join('');
                    return (
                      <div
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 16px',
                          background: isPresent ? `${vc.pill}` : '#FAFAFA',
                          borderTop: idx > 0 ? '1px solid #F0F0F0' : 'none',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isPresent ? vc.pill : 'rgba(255,255,255,0.08)',
                            color: isPresent ? vc.text : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 600,
                            border: `1px solid ${isPresent ? vc.border : '#E5E7EB'}`,
                          }}>
                            {initials}
                          </div>
                          <span style={{
                            fontSize: '0.97rem',
                            fontWeight: isPresent ? 600 : 400,
                            color: isPresent ? 'var(--text-main)' : 'var(--text-muted)',
                          }}>
                            {member.name}
                          </span>
                        </div>
                        {isPresent
                          ? <CheckCircle2 color="var(--accent-primary)" size={28} />
                          : <Circle color="rgba(255,255,255,0.2)" size={28} />
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra inferior fija */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '12px 16px',
        background: 'rgba(255,255,255,0.97)', borderTop: '1px solid var(--card-border)',
        display: 'flex', gap: '10px', backdropFilter: 'blur(8px)', zIndex: 20,
      }}>
        {alreadySaved ? (
          <>
            <button
              onClick={() => setAlreadySaved(false)}
              style={{
                flex: 2, padding: '14px', borderRadius: '10px',
                background: '#6C63FF', border: 'none',
                color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Editar lista
            </button>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  background: '#F0EEF8', border: '1px solid #E5E7EB',
                  color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer',
                }}
              >
                ← Volver
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setScreen('confirm')}
              style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'var(--accent-primary)', border: 'none',
                color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Guardar asistencia →
            </button>
            <div
              onClick={() => navigate('/eligibility')}
              style={{
                padding: '14px 16px', borderRadius: '10px',
                background: '#F0EEF8', border: '1px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Star size={20} color="var(--text-muted)" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
