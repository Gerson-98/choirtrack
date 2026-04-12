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
  soprano: 'Sopranos', segunda: 'Segundas', tenor: 'Tenores', bajo: 'Bajos',
};
const VOICE_COLORS: Record<string, string> = {
  soprano: '#d470b0', segunda: '#4a9ef5', tenor: '#32c88c', bajo: '#f0b450',
};
const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];

// Column widths for the report table
const COL = '1fr 48px 48px 48px 52px 36px';

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

  const allMembers = data?.members ?? [];

  const filteredMembers = allMembers.filter(m => {
    const nameOk = !filterName || m.member.name.toLowerCase().includes(filterName.toLowerCase());
    const voiceOk = !filterVoice || m.member.voice === filterVoice;
    return nameOk && voiceOk;
  });

  // Group by voice
  const groupedByVoice = () => {
    const groups: Record<string, ReportMember[]> = {};
    for (const v of VOICE_ORDER) groups[v] = [];
    for (const m of filteredMembers) {
      const v = m.member.voice in groups ? m.member.voice : 'soprano';
      groups[v].push(m);
    }
    return groups;
  };

  const handleExport = async () => {
    if (!tableRef.current || !data) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        useCORS: true,
        logging: false,
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

  // Compute stats for the attendance cell color
  const cellColor = (met: boolean, hasPerm: boolean) =>
    hasPerm ? '#7C3AED' : met ? '#059669' : '#DC2626';

  const cellBg = (met: boolean, hasPerm: boolean) =>
    hasPerm ? 'rgba(124,58,237,0.08)' : met ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)';

  // Shared cell style
  const numCell = (met: boolean, hasPerm: boolean) => ({
    textAlign: 'center' as const,
    fontSize: '0.82rem',
    fontWeight: 700,
    color: cellColor(met, hasPerm),
    background: cellBg(met, hasPerm),
    borderRadius: '5px',
    padding: '3px 2px',
  });

  const groups = groupedByVoice();
  const totalEligible = filteredMembers.filter(m => m.isEligible).length;
  const totalCount = filteredMembers.length;

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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
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
          /* ─── Tabla captureable ─────────────────────────────── */
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <div
              ref={tableRef}
              style={{
                background: '#fff',
                minWidth: '520px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {/* ── Encabezado del reporte ── */}
              <div style={{
                padding: '14px 16px 12px',
                borderBottom: '2px solid #E5E7EB',
                background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)',
              }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1F2937', marginBottom: '2px' }}>
                  🎵 ChoirTrack — Reporte Semanal
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '8px' }}>
                  {weekLabel} · Generado el {format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}
                </div>
                {/* Sesiones realizadas */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '5am', count: sc.am_prayer },
                    { label: '9am', count: sc.morning_prayer },
                    { label: '6pm', count: sc.pm_prayer },
                    { label: 'Ensayo', count: sc.rehearsal },
                  ].map(({ label, count }) => (
                    <span key={label} style={{
                      fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px',
                      background: count > 0 ? 'rgba(108,99,255,0.12)' : '#F3F4F6',
                      color: count > 0 ? '#5B21B6' : '#9CA3AF',
                      fontWeight: 700, border: count > 0 ? '1px solid rgba(108,99,255,0.2)' : '1px solid #E5E7EB',
                    }}>
                      {label}: {count} ses.
                    </span>
                  ))}
                  <span style={{
                    fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(5,150,105,0.1)', color: '#065F46', fontWeight: 700,
                    border: '1px solid rgba(5,150,105,0.2)', marginLeft: 'auto',
                  }}>
                    ✅ {totalEligible}/{totalCount} elegibles
                  </span>
                </div>
              </div>

              {/* ── Cabecera de columnas ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: COL,
                padding: '7px 14px',
                background: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                gap: '4px',
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Miembro
                </div>
                {['5am', '9am', '6pm', 'Rep.', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* ── Filas agrupadas por voz ── */}
              {filteredMembers.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.88rem' }}>
                  No hay miembros con esos filtros.
                </div>
              ) : (
                VOICE_ORDER.map(voice => {
                  const list = groups[voice];
                  if (!list.length) return null;
                  const vc = VOICE_COLORS[voice];
                  return (
                    <div key={voice}>
                      {/* Voice section header */}
                      <div style={{
                        padding: '5px 14px',
                        background: `${vc}18`,
                        borderTop: '1px solid #F0F0F0',
                        borderBottom: `1px solid ${vc}30`,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px',
                          borderRadius: '50%', background: vc, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: vc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {VOICE_LABELS[voice]}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: vc, opacity: 0.7 }}>
                          ({list.length} miembros · {list.filter(m => m.isEligible).length} elegibles)
                        </span>
                      </div>

                      {/* Member rows */}
                      {list.map((item, idx) => {
                        const { member, counts, permissions: perms, isEligible } = item;
                        const amPerm = perms?.am_prayer ?? false;
                        const pmPerm = perms?.pm_prayer ?? false;
                        const mornPerm = perms?.morning_prayer ?? false;
                        const rPerm = perms?.rehearsal ?? false;

                        // Lógica unificada (sin distinción de género)
                        const amMet = amPerm || counts.am >= 2;
                        const totalPrayer = counts.am + counts.pm + counts.morning
                          + (pmPerm ? 1 : 0) + (mornPerm ? 1 : 0);
                        const totalMet = totalPrayer >= 6;
                        const rehearsalMet = rPerm || counts.rehearsal >= 2;

                        return (
                          <div
                            key={member.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: COL,
                              padding: '8px 14px',
                              borderTop: idx > 0 ? '1px solid #F5F5F7' : 'none',
                              background: isEligible ? '#FAFFFE' : '#FFFAFA',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {/* Nombre */}
                            <div style={{
                              fontSize: '0.83rem', fontWeight: 500, color: '#1F2937',
                              lineHeight: 1.3, wordBreak: 'break-word',
                            }}>
                              {member.name}
                            </div>

                            {/* 5am */}
                            <div style={numCell(amMet, amPerm)}>
                              {amPerm ? '✋' : counts.am}
                            </div>

                            {/* 9am */}
                            <div style={numCell(totalMet, mornPerm)}>
                              {mornPerm ? '✋' : counts.morning}
                            </div>

                            {/* 6pm */}
                            <div style={numCell(totalMet, pmPerm)}>
                              {pmPerm ? '✋' : counts.pm}
                            </div>

                            {/* Ensayo */}
                            <div style={numCell(rehearsalMet, rPerm)}>
                              {rPerm ? '✋' : counts.rehearsal}
                            </div>

                            {/* Estado */}
                            <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                              {isEligible ? '✅' : '❌'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}

              {/* ── Leyenda y pie ── */}
              {data && filteredMembers.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderTop: '2px solid #E5E7EB',
                  background: '#F9FAFB',
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                  gap: '6px', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                      { color: '#059669', bg: 'rgba(5,150,105,0.08)', label: 'Requisito cumplido' },
                      { color: '#DC2626', bg: 'rgba(220,38,38,0.06)', label: 'Falta' },
                      { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', label: '✋ Permiso' },
                    ].map(({ color, bg, label }) => (
                      <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#6B7280' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: bg, border: `1px solid ${color}30` }} />
                        <span style={{ color }}>{label}</span>
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                    {totalEligible} elegibles · {totalCount - totalEligible} no elegibles · {totalCount} total
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
