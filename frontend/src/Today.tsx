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

interface EligSummary {
  eligible: string[];
  atRisk: string[];
}

interface Props {
  role: string;
  onLogout: () => void;
  onBack?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  am_prayer: 'Oración 5am',
  pm_prayer: 'Oración 6pm',
  morning_prayer: 'Oración 9am',
  rehearsal: 'Ensayo',
};

const ROLE_EMOJI: Record<string, string> = {
  am_prayer: '🌅',
  pm_prayer: '🌙',
  morning_prayer: '☀️',
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
  const [savedFlash, setSavedFlash] = useState(false);
  const [screen, setScreen] = useState<Screen>('list');
  const [openVoices, setOpenVoices] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isEditing, setIsEditing] = useState(false);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [sessionUpdatedAt, setSessionUpdatedAt] = useState<string | null>(null);
  const [eligibilitySummary, setEligibilitySummary] = useState<EligSummary | null>(null);
  const navigate = useNavigate();

  const userRole = localStorage.getItem('role') ?? '';
  const isDirector = userRole === 'director';

  // Fecha de hoy (local)
  const todayDate = startOfDay(new Date());

  const weekDays = getWeekDays(selectedDate);
  const allowedDays = getAllowedDays(role, weekDays);

  // ── Navegación de semanas ──────────────────────────────────
  const selectedDOW = selectedDate.getDay();
  const selectedWeekSunday = subDays(selectedDate, selectedDOW);
  const todayDOW = todayDate.getDay();
  const todayWeekSunday = subDays(todayDate, todayDOW);

  const canGoNextWeek = selectedWeekSunday.getTime() < todayWeekSunday.getTime();

  const goPrevWeek = () => {
    const prevSunday = addDays(selectedWeekSunday, -7);
    const prevAllowed = getAllowedDays(role, getWeekDays(addDays(prevSunday, 3)));
    if (prevAllowed.length > 0) {
      const sameDOW = prevAllowed.find(d => d.getDay() === selectedDOW);
      setSelectedDate(sameDOW ?? prevAllowed[prevAllowed.length - 1]);
    }
  };

  const goNextWeek = () => {
    if (!canGoNextWeek) return;
    const nextSunday = addDays(selectedWeekSunday, 7);
    const nextAllowed = getAllowedDays(role, getWeekDays(addDays(nextSunday, 3)))
      .filter(d => d.getTime() <= todayDate.getTime());
    if (nextAllowed.length > 0) {
      const sameDOW = nextAllowed.find(d => d.getDay() === selectedDOW);
      setSelectedDate(sameDOW ?? nextAllowed[nextAllowed.length - 1]);
    }
  };

  // Selector de fecha directo — se ajusta al día permitido más cercano
  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    const picked = startOfDay(new Date(y, m - 1, d));
    if (picked.getTime() > todayDate.getTime()) return;

    const pickedAllowed = getAllowedDays(role, getWeekDays(picked))
      .filter(da => da.getTime() <= todayDate.getTime());

    if (pickedAllowed.length === 0) { setSelectedDate(picked); return; }

    const exact = pickedAllowed.find(da => da.getTime() === picked.getTime());
    if (exact) { setSelectedDate(exact); return; }

    // Día permitido más cercano (por diferencia absoluta)
    let closest = pickedAllowed[0];
    let minDiff = Math.abs(closest.getTime() - picked.getTime());
    for (const da of pickedAllowed) {
      const diff = Math.abs(da.getTime() - picked.getTime());
      if (diff < minDiff) { minDiff = diff; closest = da; }
    }
    setSelectedDate(closest);
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  async function loadData(date: Date) {
    setLoading(true);
    setScreen('list');
    setIsEditing(false);
    setSavedFlash(false);
    setLastSavedBy(null);
    setSessionUpdatedAt(null);
    setEligibilitySummary(null);
    try {
      const dateStr = toLocalDateString(date);
      const [membersRes, sessionRes] = await Promise.all([
        api.get('/members'),
        api.get(`/sessions/date/${dateStr}?type=${role}`),
      ]);

      const allMembers = membersRes.data;
      setMembers(allMembers);
      setSessionId(sessionRes.data.id);

      const presentIds = new Set<number>(
        sessionRes.data.attendances
          .filter((a: any) => a.isPresent)
          .map((a: any) => a.memberId as number),
      );
      setSelected(presentIds);

      if (sessionRes.data.lastSavedBy) {
        setIsEditing(true);
        setLastSavedBy(sessionRes.data.lastSavedBy);
      }
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
    setSaving(true);
    setSaveError(null);
    try {
      await api.post('/attendance/save', {
        sessionId: sessionId ?? undefined,
        date: toLocalDateString(selectedDate),
        role,
        presentMemberIds: Array.from(selected),
      });
      const username = getUsernameFromToken();
      const now = new Date().toISOString();
      setLastSavedBy(username);
      setSessionUpdatedAt(now);
      setIsEditing(true);

      // Obtener resumen de elegibilidad después de guardar
      try {
        const dateStr = toLocalDateString(selectedDate);
        const eligRes = await api.get(`/eligibility/${dateStr}`);
        const eligData = eligRes.data as Array<{
          member: { name: string; gender: string };
          counts: { am: number; pm: number; morning: number; rehearsal: number };
          permissions?: { am_prayer: boolean; pm_prayer: boolean; morning_prayer: boolean; rehearsal: boolean };
          isEligible: boolean;
        }>;

        const eligible = eligData.filter(d => d.isEligible).map(d => d.member.name);

        const atRisk = eligData.filter(d => {
          if (d.isEligible) return false;
          const { am, pm, morning, rehearsal } = d.counts;
          const perms = d.permissions ?? { am_prayer: false, pm_prayer: false, morning_prayer: false, rehearsal: false };

          // Lógica unificada (sin distinción de género)
          const req1Met = perms.am_prayer || am >= 2;
          const totalPrayer = am + pm + morning
            + (perms.pm_prayer ? 1 : 0)
            + (perms.morning_prayer ? 1 : 0);
          const req2Met = totalPrayer >= 6;
          const req3Met = perms.rehearsal || rehearsal >= 2;

          const notMet = [req1Met, req2Met, req3Met].filter(r => !r).length;
          if (notMet !== 1) return false;
          // Necesita exactamente 1 asistencia más en el requisito faltante
          if (!req1Met) return am >= 1;            // am=1 → +1 = 2
          if (!req2Met) return totalPrayer >= 5;   // total=5 → +1 oración = 6
          return rehearsal >= 1;                    // rehearsal=1 → +1 = 2
        }).map(d => d.member.name);

        if (eligible.length > 0 || atRisk.length > 0) {
          setEligibilitySummary({ eligible, atRisk });
        }
      } catch {
        // No fallar el guardado si falla la elegibilidad
      }

      if (isEditing) {
        setSavedFlash(true);
        setTimeout(() => {
          setSavedFlash(false);
          setScreen('success');
        }, 1500);
      } else {
        setScreen('success');
      }
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
          justifyContent: 'center', minHeight: '70vh', gap: '14px', padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--success)' }}>¡Asistencia guardada!</h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
            {presentCount} presente{presentCount !== 1 ? 's' : ''} registrado{presentCount !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Puedes volver a este día para corregir
          </p>

          {/* Resumen de elegibilidad */}
          {eligibilitySummary && (eligibilitySummary.eligible.length > 0 || eligibilitySummary.atRisk.length > 0) && (
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: '12px', padding: '14px 16px',
              width: '100%', maxWidth: '320px', textAlign: 'left',
              fontSize: '0.82rem', lineHeight: 1.5,
            }}>
              {eligibilitySummary.eligible.length > 0 && (
                <p style={{ marginBottom: eligibilitySummary.atRisk.length > 0 ? '8px' : 0 }}>
                  <span style={{ color: '#10B981', fontWeight: 700 }}>
                    ✅ Recién elegibles ({eligibilitySummary.eligible.length}):
                  </span>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {eligibilitySummary.eligible.join(', ')}
                  </span>
                </p>
              )}
              {eligibilitySummary.atRisk.length > 0 && (
                <p>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                    ⚠️ En riesgo ({eligibilitySummary.atRisk.length}):
                  </span>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {eligibilitySummary.atRisk.join(', ')}
                  </span>
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', width: '100%', maxWidth: '320px' }}>
            <button
              onClick={() => { setScreen('list'); setEligibilitySummary(null); }}
              style={{
                flex: 2, padding: '12px 0', borderRadius: '10px',
                background: '#6C63FF', border: 'none',
                color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Editar lista
            </button>
            <button
              onClick={() => { setEligibilitySummary(null); navigate('/'); }}
              style={{
                flex: 1, padding: '12px 0', borderRadius: '10px',
                background: '#F0EEF8', border: '1px solid #E5E7EB',
                color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer',
              }}
            >
              🏠
            </button>
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          <div className="count-badge">{presentCount} / {members.length}</div>
          <span
            title="Permisos de ausencia"
            onClick={() => navigate('/permissions')}
            style={{ cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1 }}
          >
            ✋
          </span>
          <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
        </div>
      </div>

      {/* Navegación: selector de semana + fecha */}
      <div style={{
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--card-border)',
      }}>
        {/* Fila 1: semanas + date input */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px 4px',
        }}>
          <button
            onClick={goPrevWeek}
            title="Semana anterior"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <input
            type="date"
            value={toLocalDateString(selectedDate)}
            max={toLocalDateString(todayDate)}
            onChange={handleDateInput}
            style={{
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              background: '#FAFAFA',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          />

          <button
            onClick={goNextWeek}
            disabled={!canGoNextWeek}
            title="Semana siguiente"
            style={{
              background: 'none', border: 'none',
              cursor: canGoNextWeek ? 'pointer' : 'default',
              color: canGoNextWeek ? 'var(--text-muted)' : '#D1D5DB',
              padding: '4px', display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Fila 2: píldoras de días */}
        <div style={{
          display: 'flex', gap: '4px', flexWrap: 'wrap',
          justifyContent: 'center', padding: '0 12px 8px',
        }}>
          {allowedDays.map(d => {
            const isSelected = d.getTime() === selectedDate.getTime();
            const isToday = d.getTime() === todayDate.getTime();
            const isFuture = d.getTime() > todayDate.getTime();
            return (
              <button
                key={d.toISOString()}
                onClick={() => !isFuture && setSelectedDate(d)}
                disabled={isFuture}
                style={{
                  padding: '4px 10px', borderRadius: '20px',
                  cursor: isFuture ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem', fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? 'var(--accent-primary)' : isFuture ? '#F3F4F6' : '#EEEDF6',
                  border: isToday && !isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  color: isSelected ? '#fff' : isFuture ? '#D1D5DB' : 'var(--text-muted)',
                  opacity: isFuture ? 0.45 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {format(d, 'EEE d', { locale: es })}
              </button>
            );
          })}
        </div>
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

      {/* Flash de guardado en modo edición */}
      {savedFlash && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: '398px',
          background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px',
          padding: '10px 14px', fontSize: '0.88rem', color: '#16A34A',
          fontWeight: 600, zIndex: 21, textAlign: 'center',
        }}>
          ✅ Cambios guardados
        </div>
      )}

      {/* Barra inferior fija */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '12px 16px',
        background: 'rgba(255,255,255,0.97)', borderTop: '1px solid var(--card-border)',
        display: 'flex', gap: '10px', backdropFilter: 'blur(8px)', zIndex: 20,
      }}>
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving || savedFlash}
              style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'var(--accent-primary)', border: 'none',
                color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                opacity: (saving || savedFlash) ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando…' : '💾 Guardar cambios'}
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
