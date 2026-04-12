import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import api from './api';
import { toLocalDateString } from './utils';
import { LogOut, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EligibilityItem {
  member: { id: number; name: string; voice: string; gender: string };
  counts: { am: number; pm: number; morning: number; rehearsal: number; total: number };
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

// Celda de stat individual dentro del grid de 3 columnas
function StatCell({
  icon, label, value, met, hasPerm,
}: {
  icon: string;
  label: string;
  value: string;
  met: boolean;
  hasPerm: boolean;
}) {
  const color = hasPerm ? '#6C63FF' : met ? '#10B981' : '#EF4444';
  const bg = hasPerm ? 'rgba(108,99,255,0.07)' : met ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)';
  const border = hasPerm ? 'rgba(108,99,255,0.2)' : met ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.18)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '5px 3px', borderRadius: '8px', gap: '2px',
      background: bg, border: `1px solid ${border}`,
      minWidth: 0, overflow: 'hidden',
    }}>
      <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, lineHeight: 1 }}>
        {hasPerm ? '✋' : value}
      </span>
      <span style={{ fontSize: '0.6rem', color: color, opacity: 0.75, lineHeight: 1, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
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

  // ── Card de miembro con layout de 2 filas ─────────────────
  const MemberCard = ({ item }: { item: EligibilityItem }) => {
    const { member, counts, permissions: perms, isEligible } = item;
    const initials = member.name.split(' ').slice(0, 2).map(n => n[0]).join('');
    const amPerm = perms?.am_prayer ?? false;
    const pmPerm = perms?.pm_prayer ?? false;
    const mornPerm = perms?.morning_prayer ?? false;
    const rPerm = perms?.rehearsal ?? false;
    const hasAnyPerm = amPerm || pmPerm || mornPerm || rPerm;

    // Lógica unificada (igual para todos)
    const req1Met = amPerm || counts.am >= 2;
    const totalPrayer = (counts.total ?? counts.am + counts.pm + counts.morning)
      + (pmPerm ? 1 : 0) + (mornPerm ? 1 : 0);
    const req2Met = totalPrayer >= 6;
    const req3Met = rPerm || counts.rehearsal >= 2;
    const anyPrayerPerm = pmPerm || mornPerm;

    return (
      <div style={{
        padding: '9px 12px 10px',
        borderLeft: `3px solid ${isEligible ? '#10B981' : '#EF4444'}`,
        borderTop: '1px solid #F0F0F0',
        background: isEligible ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.03)',
      }}>
        {/* Fila 1: avatar · nombre · ✅/❌ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: isEligible ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: isEligible ? '#10B981' : '#EF4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700,
          }}>
            {initials}
          </div>
          {/* nombre con min-width:0 para que el truncado funcione */}
          <span style={{
            flex: 1, minWidth: 0,
            fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {member.name}
            {hasAnyPerm && (
              <span
                title="Tiene permiso de ausencia esta semana"
                style={{ marginLeft: '5px', fontSize: '0.78rem' }}
              >✋</span>
            )}
          </span>
          <span style={{ fontSize: '1.05rem', flexShrink: 0 }}>
            {isEligible ? '✅' : '❌'}
          </span>
        </div>

        {/* Fila 2: grid 3 columnas iguales — siempre caben en cualquier pantalla */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '5px',
          // sangría alineada con el nombre (avatar 30px + gap 8px)
          paddingLeft: '38px',
        }}>
          <StatCell
            icon="🌅"
            label="5am ≥2"
            value={`${counts.am}/2`}
            met={req1Met}
            hasPerm={amPerm}
          />
          <StatCell
            icon="🌅🌙☀️"
            label="total ≥6"
            value={`${totalPrayer}/6`}
            met={req2Met}
            hasPerm={anyPrayerPerm}
          />
          <StatCell
            icon="🎵"
            label="ensayo ≥2"
            value={`${counts.rehearsal}/2`}
            met={req3Met}
            hasPerm={rPerm}
          />
        </div>
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

  // Helper para renderizar una sección (elegibles / no elegibles)
  const Section = ({
    isElig,
    open,
    setOpen,
    byVoice,
    count,
    emptyMsg,
  }: {
    isElig: boolean;
    open: boolean;
    setOpen: (v: boolean) => void;
    byVoice: Record<string, EligibilityItem[]>;
    count: number;
    emptyMsg: string;
  }) => {
    const color = isElig ? '#10B981' : '#EF4444';
    const borderColor = isElig ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)';
    const bgColor = isElig ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.05)';
    const label = isElig ? `✅ Pueden subir (${count})` : `❌ Faltan requisitos (${count})`;

    return (
      <div style={{ marginBottom: '8px' }}>
        {/* Header del acordeón */}
        <div
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            background: bgColor,
            borderRadius: open ? '10px 10px 0 0' : '10px',
            border: `1px solid ${borderColor}`,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 700, color, fontSize: '0.95rem' }}>{label}</span>
          {open
            ? <ChevronDown size={16} color={color} />
            : <ChevronRight size={16} color={color} />
          }
        </div>

        {/* Cuerpo */}
        {open && (
          <div style={{
            border: `1px solid ${borderColor}`, borderTop: 'none',
            borderRadius: '0 0 10px 10px', overflow: 'hidden',
          }}>
            {VOICE_ORDER.map(voice => {
              const list = byVoice[voice];
              if (!list.length) return null;
              const vc = VOICE_COLORS[voice];
              return (
                <div key={voice}>
                  <div style={{
                    padding: '5px 12px', background: '#F9F9FB',
                    fontSize: '0.7rem', fontWeight: 700, color: vc,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderTop: '1px solid #F0F0F0',
                  }}>
                    {VOICE_LABELS[voice]} ({list.length})
                  </div>
                  {list.map(item => <MemberCard key={item.member.id} item={item} />)}
                </div>
              );
            })}
            {count === 0 && (
              <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {emptyMsg}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

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

        {/* Resumen numérico */}
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

        {/* Leyenda de requisitos */}
        <div className="glass-panel" style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Requisitos esta semana
          </p>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            🌅 <strong>5am estricto:</strong> ≥ 2 asistencias<br />
            🌅🌙☀️ <strong>Total oraciones:</strong> ≥ 6 (5am + 6pm + 9am)<br />
            🎵 <strong>Ensayo:</strong> ≥ 2 asistencias
          </div>
          <p style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '6px' }}>
            ✋ = Permiso de ausencia · celdas con borde <span style={{ color: '#6C63FF' }}>morado</span> = permiso activo
          </p>
        </div>

        {/* Acordeón ELEGIBLES */}
        <Section
          isElig={true}
          open={eligibleOpen}
          setOpen={setEligibleOpen}
          byVoice={byVoiceEligible}
          count={elegibles}
          emptyMsg="Ningún miembro cumple todos los requisitos aún."
        />

        {/* Acordeón NO ELEGIBLES */}
        <Section
          isElig={false}
          open={noEligibleOpen}
          setOpen={setNoEligibleOpen}
          byVoice={byVoiceNoEligible}
          count={total - elegibles}
          emptyMsg="¡Todos cumplen los requisitos!"
        />

      </div>
    </>
  );
}
