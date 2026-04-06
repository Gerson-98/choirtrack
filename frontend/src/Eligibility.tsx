import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import api from './api';
import { toLocalDateString } from './utils';
import { LogOut, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EligibilityItem {
  member: { id: number; name: string; voice: string; gender: string };
  counts: { am: number; pm: number; morning: number; rehearsal: number };
  permissions?: { am_prayer: boolean; pm_prayer: boolean; morning_prayer: boolean; rehearsal: boolean };
  isEligible: boolean;
}

interface Props {
  onLogout: () => void;
}

const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];
const VOICE_LABELS: Record<string, string> = {
  soprano: 'Sopranos',
  segunda: 'Segundas',
  tenor: 'Tenores',
  bajo: 'Bajos',
};
const VOICE_COLORS: Record<string, string> = {
  soprano: '#d470b0',
  segunda: '#4a9ef5',
  tenor: '#32c88c',
  bajo: '#f0b450',
};

function Pill({ met, label }: { met: boolean; label: string }) {
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '20px',
      background: met ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
      color: met ? '#10B981' : '#EF4444',
      border: `1px solid ${met ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
    }}>
      {label}
    </span>
  );
}

export default function Eligibility({ onLogout }: Props) {
  const [data, setData] = useState<EligibilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibleOpen, setEligibleOpen] = useState(true);
  const [noEligibleOpen, setNoEligibleOpen] = useState(false);
  const navigate = useNavigate();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const weekLabel = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM", { locale: es })}`;

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/eligibility/${toLocalDateString(today)}`);
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const eligibleItems = data.filter(d => d.isEligible);
  const noEligibleItems = data.filter(d => !d.isEligible);
  const elegibles = eligibleItems.length;
  const total = data.length;

  const groupByVoice = (items: EligibilityItem[]) => {
    const map: Record<string, EligibilityItem[]> = {};
    for (const v of VOICE_ORDER) map[v] = [];
    for (const item of items) {
      const v = item.member.voice in map ? item.member.voice : 'soprano';
      map[v].push(item);
    }
    return map;
  };

  const byVoiceEligible = groupByVoice(eligibleItems);
  const byVoiceNoEligible = groupByVoice(noEligibleItems);

  const MemberCard = ({ item }: { item: EligibilityItem }) => {
    const { member, counts, permissions: perms, isEligible } = item;
    const initials = member.name.split(' ').slice(0, 2).map(n => n[0]).join('');
    const amPerm = perms?.am_prayer ?? false;
    const pmPerm = perms?.pm_prayer ?? false;
    const mornPerm = perms?.morning_prayer ?? false;
    const rPerm = perms?.rehearsal ?? false;
    const hasAnyPerm = amPerm || pmPerm || mornPerm || rPerm;
    const isFemale = member.gender === 'F';

    const amMet = amPerm || counts.am >= 2;
    const combinedCount = isFemale ? counts.pm + counts.morning : counts.am + counts.pm;
    const combinedPerm = isFemale ? (pmPerm || mornPerm) : (amPerm || pmPerm);
    const combinedMet = combinedPerm || combinedCount >= 4;
    const rehearsalMet = rPerm || counts.rehearsal >= 2;

    const combinedLabel = isFemale
      ? `🌙☀️ ${combinedCount}/4${combinedPerm ? ' ✋' : ''}`
      : `🌅🌙 ${combinedCount}/4${combinedPerm ? ' ✋' : ''}`;

    return (
      <div style={{
        padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderLeft: `3px solid ${isEligible ? '#10B981' : '#EF4444'}`,
        borderTop: '1px solid #F0F0F0',
        background: isEligible ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: isEligible ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: isEligible ? '#10B981' : '#EF4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.92rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {member.name}
              {hasAnyPerm && (
                <span title="Tiene permiso de ausencia esta semana" style={{ fontSize: '0.85rem' }}>✋</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Pill met={amMet} label={`🌅 ${counts.am}/2${amPerm ? ' ✋' : ''}`} />
              <Pill met={combinedMet} label={combinedLabel} />
              <Pill met={rehearsalMet} label={`🎵 ${counts.rehearsal}/2${rPerm ? ' ✋' : ''}`} />
            </div>
          </div>
        </div>
        <span style={{ fontSize: '1.2rem' }}>{isEligible ? '✅' : '❌'}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      </div>
    );
  }

  return (
    <>
      <div className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowLeft
            size={22} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
            onClick={() => navigate(-1)}
          />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>⭐ Elegibles</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Semana {weekLabel}</p>
          </div>
        </div>
        <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
      </div>

      <div className="container" style={{ paddingBottom: '32px' }}>
        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', borderLeft: '3px solid #10B981' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981' }}>{elegibles}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pueden subir ✅</div>
          </div>
          <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', borderLeft: '3px solid #EF4444' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#EF4444' }}>{total - elegibles}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Faltan requisitos ❌</div>
          </div>
        </div>

        {/* Requisitos */}
        <div className="glass-panel" style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '7px', fontWeight: 600, textTransform: 'uppercase' }}>
            Requisitos semana actual
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Pill met={true} label="🌅 5am ≥ 2" />
            <Pill met={true} label="Combinadas ≥ 4" />
            <Pill met={true} label="🎵 Ensayo ≥ 2" />
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            ♀ Combinadas = 🌙6pm + ☀️9am · ♂ Combinadas = 🌅5am + 🌙6pm
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ✋ = Permiso de ausencia (requisito automáticamente cumplido)
          </p>
        </div>

        {/* ── SECCIÓN ELEGIBLES (abierta por defecto) ── */}
        <div style={{ marginBottom: '8px' }}>
          <div
            onClick={() => setEligibleOpen(p => !p)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(16,185,129,0.08)',
              borderRadius: eligibleOpen ? '10px 10px 0 0' : '10px',
              border: '1px solid rgba(16,185,129,0.25)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontWeight: 700, color: '#10B981', fontSize: '0.95rem' }}>
              ✅ Pueden subir ({elegibles})
            </span>
            {eligibleOpen
              ? <ChevronDown size={16} color="#10B981" />
              : <ChevronRight size={16} color="#10B981" />
            }
          </div>

          {eligibleOpen && (
            <div style={{ border: '1px solid rgba(16,185,129,0.25)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {VOICE_ORDER.map(voice => {
                const list = byVoiceEligible[voice];
                if (!list.length) return null;
                const color = VOICE_COLORS[voice];
                return (
                  <div key={voice}>
                    <div style={{ padding: '6px 14px', background: '#F9F9FB', fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid #F0F0F0' }}>
                      {VOICE_LABELS[voice]} ({list.length})
                    </div>
                    {list.map(item => <MemberCard key={item.member.id} item={item} />)}
                  </div>
                );
              })}
              {elegibles === 0 && (
                <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Ningún miembro cumple todos los requisitos aún.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── SECCIÓN NO ELEGIBLES (cerrada por defecto) ── */}
        <div style={{ marginBottom: '8px' }}>
          <div
            onClick={() => setNoEligibleOpen(p => !p)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.05)',
              borderRadius: noEligibleOpen ? '10px 10px 0 0' : '10px',
              border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '0.95rem' }}>
              ❌ Faltan requisitos ({total - elegibles})
            </span>
            {noEligibleOpen
              ? <ChevronDown size={16} color="#EF4444" />
              : <ChevronRight size={16} color="#EF4444" />
            }
          </div>

          {noEligibleOpen && (
            <div style={{ border: '1px solid rgba(239,68,68,0.2)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {VOICE_ORDER.map(voice => {
                const list = byVoiceNoEligible[voice];
                if (!list.length) return null;
                const color = VOICE_COLORS[voice];
                return (
                  <div key={voice}>
                    <div style={{ padding: '6px 14px', background: '#F9F9FB', fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid #F0F0F0' }}>
                      {VOICE_LABELS[voice]} ({list.length})
                    </div>
                    {list.map(item => <MemberCard key={item.member.id} item={item} />)}
                  </div>
                );
              })}
              {total - elegibles === 0 && (
                <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  ¡Todos cumplen los requisitos!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
