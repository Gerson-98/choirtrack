import { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, LogOut, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import api from './api';
import { toLocalDateString } from './utils';

interface ReportMember {
  member: { id: number; name: string; voice: string; gender: string };
  counts: { am: number; pm: number; morning: number; rehearsal: number };
  permissions?: { am_prayer: boolean; pm_prayer: boolean; morning_prayer: boolean; rehearsal: boolean };
  isEligible: boolean;
}

interface ReportData {
  weekStart: string;
  weekEnd: string;
  sessionCounts: { am_prayer: number; pm_prayer: number; morning_prayer: number; rehearsal: number };
  members: ReportMember[];
}

interface Props {
  onLogout: () => void;
}

const VOICE_LABELS: Record<string, string> = {
  soprano: 'Soprano', segunda: 'Segunda', tenor: 'Tenor', bajo: 'Bajo',
};
const VOICE_COLORS: Record<string, string> = {
  soprano: '#d470b0', segunda: '#4a9ef5', tenor: '#32c88c', bajo: '#f0b450',
};
const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];

export default function Report({ onLogout }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);

  const [weekRef, setWeekRef] = useState<Date>(new Date());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filterName, setFilterName] = useState('');
  const [filterVoice, setFilterVoice] = useState('');

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(weekRef, { weekStartsOn: 0 });
  const weekLabel = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
  const dateStr = toLocalDateString(weekRef);

  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isCurrentWeek = weekStart.getTime() === todayWeekStart.getTime();

  useEffect(() => {
    loadData();
  }, [dateStr]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get(`/report/week?date=${dateStr}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const goPrevWeek = () => setWeekRef(w => subWeeks(w, 1));
  const goNextWeek = () => { if (!isCurrentWeek) setWeekRef(w => addWeeks(w, 1)); };

  const filteredMembers = (data?.members ?? []).filter(m => {
    const nameOk = !filterName || m.member.name.toLowerCase().includes(filterName.toLowerCase());
    const voiceOk = !filterVoice || m.member.voice === filterVoice;
    return nameOk && voiceOk;
  });

  const handleExport = async () => {
    if (!tableRef.current || !data) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `choirtrack-reporte-${data.weekStart}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const sc = data?.sessionCounts ?? { am_prayer: 0, pm_prayer: 0, morning_prayer: 0, rehearsal: 0 };

  return (
    <>
      {/* Header */}
      <div className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowLeft
            size={22} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
            onClick={() => navigate('/')}
          />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>📊 Reporte semanal</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{weekLabel}</p>
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
        <button onClick={goPrevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{weekLabel}</span>
        <button
          onClick={goNextWeek} disabled={isCurrentWeek}
          style={{ background: 'none', border: 'none', cursor: isCurrentWeek ? 'default' : 'pointer', color: isCurrentWeek ? '#D1D5DB' : 'var(--text-muted)', padding: '4px' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="container" style={{ paddingBottom: '32px', paddingTop: '12px' }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Buscar nombre…"
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            style={{
              flex: 1, minWidth: '150px', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--card-border)', fontSize: '0.85rem',
              background: '#FAFAFA', fontFamily: 'inherit',
            }}
          />
          <select
            value={filterVoice}
            onChange={e => setFilterVoice(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--card-border)', fontSize: '0.85rem',
              background: '#FAFAFA', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="">Todas las voces</option>
            {VOICE_ORDER.map(v => (
              <option key={v} value={v}>{VOICE_LABELS[v]}</option>
            ))}
          </select>
        </div>

        {/* Botón exportar */}
        <button
          onClick={handleExport}
          disabled={exporting || loading || !data}
          style={{
            width: '100%', padding: '10px', borderRadius: '10px',
            background: '#F0EEF8', border: '1px solid #E5E7EB',
            color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600,
            cursor: (exporting || loading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginBottom: '12px', opacity: (exporting || !data) ? 0.6 : 1,
          }}
        >
          <Camera size={16} />
          {exporting ? 'Exportando…' : '📸 Exportar imagen'}
        </button>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>Cargando…</p>
        ) : !data ? (
          <p style={{ textAlign: 'center', color: '#EF4444', padding: '32px 0' }}>Error al cargar el reporte.</p>
        ) : (
          /* Tabla captureable */
          <div ref={tableRef} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
            {/* Encabezado del reporte */}
            <div style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid #E5E7EB',
              background: 'linear-gradient(135deg, #6C63FF08, #6C63FF15)',
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
                🎵 ChoirTrack — Reporte Semanal
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {weekLabel} · Generado {format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}
              </div>
              {/* Totales de sesiones */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: '🌅 5am', count: sc.am_prayer },
                  { label: '☀️ 9am', count: sc.morning_prayer },
                  { label: '🌙 6pm', count: sc.pm_prayer },
                  { label: '🎵 Ensayos', count: sc.rehearsal },
                ].map(({ label, count }) => (
                  <span key={label} style={{
                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px',
                    background: count > 0 ? 'rgba(108,99,255,0.1)' : '#F3F4F6',
                    color: count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}>
                    {label}: {count} sesión{count !== 1 ? 'es' : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Cabecera de tabla */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px 50px 60px 90px 40px',
              padding: '8px 14px',
              background: '#F9FAFB',
              borderBottom: '1px solid #E5E7EB',
              fontSize: '0.65rem', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <div>Miembro</div>
              <div style={{ textAlign: 'center' }}>Voz</div>
              <div style={{ textAlign: 'center' }}>🌅</div>
              <div style={{ textAlign: 'center' }}>☀️</div>
              <div style={{ textAlign: 'center' }}>🌙</div>
              <div style={{ textAlign: 'center' }}>🎵</div>
              <div style={{ textAlign: 'center' }}>Comb.</div>
              <div style={{ textAlign: 'center' }}></div>
            </div>

            {/* Filas */}
            {filteredMembers.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No hay miembros con esos filtros.
              </div>
            ) : (
              filteredMembers.map((item, idx) => {
                const { member, counts, permissions: perms, isEligible } = item;
                const amPerm = perms?.am_prayer ?? false;
                const pmPerm = perms?.pm_prayer ?? false;
                const mornPerm = perms?.morning_prayer ?? false;
                const rPerm = perms?.rehearsal ?? false;
                const isFemale = member.gender === 'F';

                const combinedCount = isFemale ? counts.pm + counts.morning : counts.am + counts.pm;
                const combinedPerm = isFemale ? (pmPerm || mornPerm) : (amPerm || pmPerm);
                const combinedMet = combinedPerm || combinedCount >= 4;
                const amMet = amPerm || counts.am >= 2;
                const rehearsalMet = rPerm || counts.rehearsal >= 2;

                const cellStyle = (met: boolean, hasPerm: boolean) => ({
                  textAlign: 'center' as const,
                  fontSize: '0.8rem', fontWeight: 600,
                  color: hasPerm ? '#6C63FF' : met ? '#10B981' : '#EF4444',
                });

                return (
                  <div
                    key={member.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px 50px 60px 90px 40px',
                      padding: '10px 14px',
                      borderTop: idx > 0 ? '1px solid #F5F5F5' : 'none',
                      background: isEligible ? 'rgba(16,185,129,0.03)' : '#FAFAFA',
                      alignItems: 'center',
                    }}
                  >
                    {/* Nombre */}
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.name}
                    </div>
                    {/* Voz */}
                    <div style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 5px', borderRadius: '10px',
                        background: `${VOICE_COLORS[member.voice] ?? '#aaa'}22`,
                        color: VOICE_COLORS[member.voice] ?? '#aaa',
                      }}>
                        {VOICE_LABELS[member.voice] ?? member.voice}
                      </span>
                    </div>
                    {/* 5am */}
                    <div style={cellStyle(amMet, amPerm)}>
                      {amPerm ? '✋' : counts.am}
                    </div>
                    {/* 9am */}
                    <div style={cellStyle(true, mornPerm)}>
                      {isFemale ? (mornPerm ? '✋' : counts.morning) : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </div>
                    {/* 6pm */}
                    <div style={cellStyle(true, pmPerm)}>
                      {pmPerm ? '✋' : counts.pm}
                    </div>
                    {/* Ensayo */}
                    <div style={cellStyle(rehearsalMet, rPerm)}>
                      {rPerm ? '✋' : counts.rehearsal}
                    </div>
                    {/* Combinadas */}
                    <div style={cellStyle(combinedMet, combinedPerm)}>
                      {combinedPerm ? '✋' : `${combinedCount}/4`}
                      <span style={{ fontSize: '0.6rem', fontWeight: 400, marginLeft: '2px' }}>
                        {isFemale ? '♀' : '♂'}
                      </span>
                    </div>
                    {/* Estado */}
                    <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                      {isEligible ? '✅' : '❌'}
                    </div>
                  </div>
                );
              })
            )}

            {/* Pie con conteo */}
            {data && (
              <div style={{
                padding: '10px 14px', borderTop: '1px solid #E5E7EB',
                background: '#F9FAFB', fontSize: '0.75rem', color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>
                  {filteredMembers.filter(m => m.isEligible).length} elegibles · {filteredMembers.filter(m => !m.isEligible).length} no elegibles
                </span>
                <span>Total: {filteredMembers.length} miembros</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
