import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Star, ClipboardList, LogOut, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { toLocalDateString, toGuatemalaTime } from './utils';

interface SessionSummary {
    type: string;
    sessionId: number | null;
    count: number;
    total: number;
}

interface EligibilityData {
    member: { id: number; name: string; voice: string };
    counts: { am: number; pm: number; rehearsal: number };
    isEligible: boolean;
}

interface WeekDay {
    date: string;
    dayOfWeek: number;
    am_prayer: number | null;
    pm_prayer: number | null;
    rehearsal: number | null | 'N/A';
}

interface WeekData {
    days: WeekDay[];
    total: number;
}

interface AuditEntry {
    date: string;
    type: string;
    presentCount: number;
    lastSavedBy: string | null;
    updatedAt: string | null;
}

interface Props {
    onLogout: () => void;
}

const SESSION_META: Record<string, { label: string; emoji: string; route: string; borderColor: string }> = {
    am_prayer: { label: 'Oración 5am', emoji: '🌅', route: '/session/am_prayer', borderColor: 'rgba(212,112,176,0.5)' },
    pm_prayer: { label: 'Oración 6pm', emoji: '🌙', route: '/session/pm_prayer', borderColor: 'rgba(74,158,245,0.5)' },
    rehearsal: { label: 'Ensayo', emoji: '🎵', route: '/session/rehearsal', borderColor: 'rgba(50,200,140,0.5)' },
};

const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];
const VOICE_LABELS: Record<string, string> = { soprano: 'Sopranos', segunda: 'Segundas', tenor: 'Tenores', bajo: 'Bajos' };
const VOICE_COLORS: Record<string, string> = { soprano: '#d470b0', segunda: '#4a9ef5', tenor: '#10b981', bajo: '#d97706' };
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const REHEARSAL_DAYS = [1, 3, 6]; // Lun, Mié, Sáb

function Pill({ met, label }: { met: boolean; label: string }) {
    return (
        <span style={{
            fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '20px',
            background: met ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: met ? '#10B981' : '#EF4444',
            border: `1px solid ${met ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
        }}>
            {label}
        </span>
    );
}

function WeekCell({ value }: { value: number | null | 'N/A' }) {
    if (value === 'N/A') return <span style={{ color: '#D1D5DB' }}>—</span>;
    if (value === null) return <span style={{ color: '#D1D5DB', fontSize: '1.1rem', lineHeight: 1 }}>·</span>;
    return (
        <span style={{
            fontWeight: value > 0 ? 700 : 400,
            color: value > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
        }}>
            {value}
        </span>
    );
}

export default function Dashboard({ onLogout }: Props) {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [eligibility, setEligibility] = useState<EligibilityData[]>([]);
    const [weekData, setWeekData] = useState<WeekData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'semana' | 'elegibles' | 'auditoria'>('semana');
    const [auditData, setAuditData] = useState<AuditEntry[]>([]);
    const [eligibleSectionOpen, setEligibleSectionOpen] = useState(true);
    const [noEligibleSectionOpen, setNoEligibleSectionOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const navigate = useNavigate();

    const today = new Date();
    const todayStr = toLocalDateString(today);
    const fechaHoy = format(today, "EEEE d 'de' MMMM", { locale: es });

    // baseDate = semana a mostrar (hoy desplazado por weekOffset semanas)
    const baseDate = addWeeks(today, weekOffset);
    const baseDateStr = toLocalDateString(baseDate);
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 });
    const weekLabel = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM", { locale: es })}`;

    const loadData = async (dateStr: string) => {
        try {
            const [dirRes, eligRes, weekRes, auditRes] = await Promise.all([
                api.get('/director/today'),
                api.get(`/eligibility/${dateStr}`),
                api.get(`/director/week?date=${dateStr}`),
                api.get(`/audit/week?date=${dateStr}`).catch(() => ({ data: [] })),
            ]);
            setSessions(dirRes.data.sessions);
            setEligibility(eligRes.data);
            setWeekData(weekRes.data);
            setAuditData(auditRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(baseDateStr); }, [weekOffset]);

    const handleRefresh = () => { setRefreshing(true); loadData(baseDateStr); };

    // ── Datos de elegibilidad por sección ─────────────────────
    const eligibleItems = eligibility.filter(d => d.isEligible);
    const noEligibleItems = eligibility.filter(d => !d.isEligible);
    const elegibles = eligibleItems.length;
    const noElegibles = noEligibleItems.length;

    const groupByVoice = (items: EligibilityData[]) => {
        const map: Record<string, EligibilityData[]> = {};
        for (const v of VOICE_ORDER) map[v] = [];
        for (const item of items) {
            const v = item.member.voice in map ? item.member.voice : 'soprano';
            map[v].push(item);
        }
        return map;
    };

    const byVoiceEligible = groupByVoice(eligibleItems);
    const byVoiceNoEligible = groupByVoice(noEligibleItems);

    // ── Alertas de sesiones sin registrar ────────────────────
    const currentHour = today.getHours();
    const todayDow = today.getDay();

    const amSession = sessions.find(s => s.type === 'am_prayer');
    const pmSession = sessions.find(s => s.type === 'pm_prayer');
    const rehearsalSession = sessions.find(s => s.type === 'rehearsal');

    const unregisteredAlerts: string[] = [];
    if (!loading) {
        if (amSession && amSession.count === 0 && currentHour >= 6) {
            unregisteredAlerts.push('⚠️ Oración 5am de hoy sin registrar');
        }
        if (pmSession && pmSession.count === 0 && currentHour >= 19) {
            unregisteredAlerts.push('⚠️ Oración 6pm de hoy sin registrar');
        }
        if (rehearsalSession && rehearsalSession.count === 0 && REHEARSAL_DAYS.includes(todayDow) && currentHour >= 21) {
            unregisteredAlerts.push('⚠️ Ensayo de hoy sin registrar');
        }
    }

    // ── Export PNG ────────────────────────────────────────────
    const handleExport = async () => {
        setExporting(true);
        try {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = 800 * scale;
            const rowH = 44, headerH = 120, voiceHeaderH = 36, requisitoH = 80;
            const totalRows = eligibility.length;
            const totalVoiceHeaders = VOICE_ORDER.filter(v => groupByVoice(eligibility)[v].length > 0).length;
            canvas.height = (headerH + requisitoH + totalVoiceHeaders * voiceHeaderH + totalRows * rowH + 40) * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(scale, scale);
            const W = 800, H = canvas.height / scale;
            ctx.fillStyle = '#0f111a';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px system-ui';
            ctx.fillText('🎵 Elegibilidad Semanal — Coro', 32, 44);
            ctx.fillStyle = '#888';
            ctx.font = '14px system-ui';
            ctx.fillText(`Semana: ${weekLabel}`, 32, 68);
            ctx.fillText(`Generado: ${format(today, "d MMM yyyy HH:mm", { locale: es })}`, 32, 88);
            ctx.fillStyle = '#00d278';
            ctx.font = 'bold 14px system-ui';
            ctx.fillText(`✅ Pueden subir: ${elegibles}`, 32, 112);
            ctx.fillStyle = '#ff416c';
            ctx.fillText(`❌ Faltan requisitos: ${noElegibles}`, 200, 112);
            let y = headerH + requisitoH;
            const allByVoice = groupByVoice(eligibility);
            for (const voice of VOICE_ORDER) {
                const list = allByVoice[voice];
                if (!list.length) continue;
                ctx.fillStyle = VOICE_COLORS[voice];
                ctx.font = 'bold 13px system-ui';
                ctx.fillText(`${VOICE_LABELS[voice].toUpperCase()} (${list.filter(i => i.isEligible).length}/${list.length} elegibles)`, 32, y + 22);
                ctx.strokeStyle = VOICE_COLORS[voice] + '44';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(32, y + 30); ctx.lineTo(W - 32, y + 30); ctx.stroke();
                y += voiceHeaderH;
                for (const item of list) {
                    const { member, counts, isEligible } = item;
                    ctx.fillStyle = isEligible ? 'rgba(0,210,120,0.06)' : 'rgba(255,65,108,0.06)';
                    ctx.beginPath(); ctx.roundRect(20, y + 2, W - 40, rowH - 4, 6); ctx.fill();
                    ctx.fillStyle = isEligible ? '#00d278' : '#ff416c';
                    ctx.fillRect(20, y + 2, 3, rowH - 4);
                    ctx.fillStyle = '#ffffff'; ctx.font = '14px system-ui';
                    ctx.fillText(member.name, 36, y + rowH / 2 + 5);
                    const pillData = [
                        { label: `🌅 ${counts.am}/1`, met: counts.am >= 1 },
                        { label: `🌙 ${counts.pm}/4`, met: counts.pm >= 4 },
                        { label: `🎵 ${counts.rehearsal}/2`, met: counts.rehearsal >= 2 },
                    ];
                    let px = 340;
                    for (const p of pillData) {
                        ctx.fillStyle = p.met ? 'rgba(0,210,120,0.2)' : 'rgba(255,65,108,0.2)';
                        ctx.beginPath(); ctx.roundRect(px, y + 10, 100, 22, 11); ctx.fill();
                        ctx.fillStyle = p.met ? '#00d278' : '#ff416c';
                        ctx.font = 'bold 11px system-ui';
                        ctx.fillText(p.label, px + 10, y + 25);
                        px += 110;
                    }
                    ctx.fillStyle = isEligible ? '#00d278' : '#ff416c';
                    ctx.font = '16px system-ui';
                    ctx.fillText(isEligible ? '✅' : '❌', W - 52, y + rowH / 2 + 5);
                    y += rowH;
                }
            }
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `coro-elegibilidad-${format(today, 'yyyy-MM-dd')}.png`;
                a.click();
                URL.revokeObjectURL(url);
                setExporting(false);
            }, 'image/png');
        } catch (e) {
            console.error(e);
            setExporting(false);
        }
    };

    // ── Subcomponente fila de miembro ─────────────────────────
    const MemberRow = ({ item, isEligible }: { item: EligibilityData; isEligible: boolean }) => {
        const { member, counts } = item;
        const initials = member.name.split(' ').slice(0, 2).map(n => n[0]).join('');
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
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: isEligible ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color: isEligible ? '#10B981' : '#EF4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700,
                    }}>
                        {initials}
                    </div>
                    <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-main)' }}>
                            {member.name}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <Pill met={counts.am >= 1} label={`🌅 ${counts.am}/1`} />
                            <Pill met={counts.pm >= 4} label={`🌙 ${counts.pm}/4`} />
                            <Pill met={counts.rehearsal >= 2} label={`🎵 ${counts.rehearsal}/2`} />
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
            {/* Header */}
            <div className="header-bar">
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>🎼 Director</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{fechaHoy}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <RefreshCw
                        size={18}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
                        onClick={handleRefresh}
                    />
                    <LogOut size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onLogout} />
                </div>
            </div>

            <div className="container" style={{ paddingBottom: '88px' }}>

                {/* ── TAB: ESTA SEMANA ── */}
                {activeTab === 'semana' && (
                    <>
                        {/* Alertas de sesiones sin registrar — solo en semana actual */}
                        {weekOffset === 0 && unregisteredAlerts.map(alert => (
                            <div key={alert} style={{
                                background: '#FEF3C7',
                                borderLeft: '4px solid #F59E0B',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                fontSize: '0.85rem',
                                color: '#92400E',
                                fontWeight: 500,
                            }}>
                                {alert}
                            </div>
                        ))}

                        {/* Grid de la semana */}
                        {weekData && (
                            <div className="glass-panel" style={{ padding: '14px', overflowX: 'auto' }}>
                                {/* Navegación ← semana → */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <button
                                        onClick={() => setWeekOffset(o => o - 1)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}
                                        aria-label="Semana anterior"
                                    >←</button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {weekLabel}
                                        </span>
                                        {weekOffset === 0 && (
                                            <span style={{
                                                fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '20px',
                                                background: 'rgba(16,185,129,0.12)', color: '#10B981',
                                                border: '1px solid rgba(16,185,129,0.3)',
                                            }}>ACTUAL</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setWeekOffset(o => o + 1)}
                                        disabled={weekOffset === 0}
                                        style={{
                                            background: 'none', border: 'none', padding: '0 4px', lineHeight: 1,
                                            cursor: weekOffset === 0 ? 'default' : 'pointer',
                                            color: weekOffset === 0 ? '#D1D5DB' : 'var(--text-muted)',
                                            fontSize: '1.2rem',
                                        }}
                                        aria-label="Semana siguiente"
                                    >→</button>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                            <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Día</th>
                                            <th style={{ textAlign: 'center', padding: '4px 6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>🌅 AM</th>
                                            <th style={{ textAlign: 'center', padding: '4px 6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>🌙 PM</th>
                                            <th style={{ textAlign: 'center', padding: '4px 6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>🎵 Ens</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekData.days.map(day => {
                                            const isToday = day.date === todayStr;
                                            const d = parseISO(day.date);
                                            return (
                                                <tr
                                                    key={day.date}
                                                    style={{ background: isToday ? 'rgba(108,99,255,0.07)' : 'transparent', borderRadius: '6px' }}
                                                >
                                                    <td style={{
                                                        padding: '7px 8px 7px 0',
                                                        fontWeight: isToday ? 700 : 400,
                                                        color: isToday ? 'var(--accent-primary)' : 'var(--text-main)',
                                                        fontSize: '0.82rem',
                                                    }}>
                                                        {DAY_NAMES[day.dayOfWeek]} {format(d, 'd')}
                                                        {isToday && weekOffset === 0 && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 600 }}>HOY</span>}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '7px 6px' }}>
                                                        <WeekCell value={day.am_prayer} />
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '7px 6px' }}>
                                                        <WeekCell value={day.pm_prayer} />
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '7px 6px' }}>
                                                        <WeekCell value={day.rehearsal} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    · = sin registro aún &nbsp;·&nbsp; — = no aplica ese día
                                </p>
                            </div>
                        )}

                        {/* Tarjetas de sesión de hoy — solo en semana actual */}
                        {weekOffset === 0 && <>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '-4px' }}>
                            Sesiones de hoy — toca para editar
                        </p>

                        {sessions.map(s => {
                            const meta = SESSION_META[s.type];
                            if (!meta) return null;
                            const pct = s.total > 0 ? Math.round((s.count / s.total) * 100) : 0;
                            return (
                                <div
                                    key={s.type}
                                    className="glass-panel"
                                    onClick={() => navigate(meta.route)}
                                    style={{
                                        padding: '20px 16px', cursor: 'pointer',
                                        borderLeft: `3px solid ${meta.borderColor}`,
                                        transition: 'transform 0.1s', userSelect: 'none',
                                    }}
                                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                                    onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                                    onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{meta.emoji}</div>
                                            <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{meta.label}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Toca para editar →
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '2rem', fontWeight: 700, color: s.count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                                {s.count}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>de {s.total}</div>
                                        </div>
                                    </div>
                                    <div style={{ background: '#E5E7EB', borderRadius: '8px', height: '6px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${pct}%`, height: '100%', borderRadius: '8px',
                                            background: 'linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))',
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>{pct}% del coro</p>
                                </div>
                            );
                        })}
                        </>}
                    </>
                )}

                {/* ── TAB: ELEGIBLES ── */}
                {activeTab === 'elegibles' && (
                    <>
                        {/* Resumen + botones exportar + presentar */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                            <div className="glass-panel" style={{ flex: 1, padding: '14px', textAlign: 'center', borderLeft: '3px solid #10B981' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981' }}>{elegibles}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pueden subir ✅</div>
                            </div>
                            <div className="glass-panel" style={{ flex: 1, padding: '14px', textAlign: 'center', borderLeft: '3px solid #EF4444' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#EF4444' }}>{noElegibles}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Faltan requisitos ❌</div>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                style={{
                                    padding: '14px 12px', borderRadius: '12px',
                                    background: '#F0EEF8', border: '1px solid #E5E7EB',
                                    color: exporting ? 'var(--text-muted)' : 'var(--text-main)',
                                    cursor: exporting ? 'default' : 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: '4px', fontSize: '0.65rem',
                                }}
                            >
                                <Download size={18} />
                                {exporting ? '…' : 'PNG'}
                            </button>
                            <button
                                onClick={() => navigate('/presentacion')}
                                style={{
                                    padding: '14px 12px', borderRadius: '12px',
                                    background: '#F0EEF8', border: '1px solid #E5E7EB',
                                    color: 'var(--text-main)', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: '4px', fontSize: '0.65rem',
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>📺</span>
                                Presentar
                            </button>
                        </div>

                        {/* Requisitos */}
                        <div className="glass-panel" style={{ padding: '10px 14px' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '7px', fontWeight: 600, textTransform: 'uppercase' }}>
                                Requisitos — semana {weekLabel}
                            </p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <Pill met={true} label="🌅 Oración 5am ≥ 1" />
                                <Pill met={true} label="🌙 Oración 6pm ≥ 4" />
                                <Pill met={true} label="🎵 Ensayo ≥ 2" />
                            </div>
                        </div>

                        {/* ── SECCIÓN ELEGIBLES (abierta por defecto) ── */}
                        <div style={{ marginBottom: '8px' }}>
                            <div
                                onClick={() => setEligibleSectionOpen(p => !p)}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'rgba(16,185,129,0.08)',
                                    borderRadius: eligibleSectionOpen ? '10px 10px 0 0' : '10px',
                                    border: '1px solid rgba(16,185,129,0.25)',
                                    cursor: 'pointer',
                                }}
                            >
                                <span style={{ fontWeight: 700, color: '#10B981', fontSize: '0.95rem' }}>
                                    ✅ Pueden subir ({elegibles})
                                </span>
                                {eligibleSectionOpen
                                    ? <ChevronDown size={16} color="#10B981" />
                                    : <ChevronRight size={16} color="#10B981" />
                                }
                            </div>

                            {eligibleSectionOpen && (
                                <div style={{
                                    border: '1px solid rgba(16,185,129,0.25)',
                                    borderTop: 'none',
                                    borderRadius: '0 0 10px 10px',
                                    overflow: 'hidden',
                                }}>
                                    {VOICE_ORDER.map(voice => {
                                        const list = byVoiceEligible[voice];
                                        if (!list.length) return null;
                                        const color = VOICE_COLORS[voice];
                                        return (
                                            <div key={voice}>
                                                <div style={{
                                                    padding: '6px 14px', background: '#F9F9FB',
                                                    fontSize: '0.72rem', fontWeight: 700,
                                                    color, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    borderTop: '1px solid #F0F0F0',
                                                }}>
                                                    {VOICE_LABELS[voice]} ({list.length})
                                                </div>
                                                {list.map(item => (
                                                    <MemberRow key={item.member.id} item={item} isEligible={true} />
                                                ))}
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
                                onClick={() => setNoEligibleSectionOpen(p => !p)}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'rgba(239,68,68,0.05)',
                                    borderRadius: noEligibleSectionOpen ? '10px 10px 0 0' : '10px',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    cursor: 'pointer',
                                }}
                            >
                                <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '0.95rem' }}>
                                    ❌ Faltan requisitos ({noElegibles})
                                </span>
                                {noEligibleSectionOpen
                                    ? <ChevronDown size={16} color="#EF4444" />
                                    : <ChevronRight size={16} color="#EF4444" />
                                }
                            </div>

                            {noEligibleSectionOpen && (
                                <div style={{
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderTop: 'none',
                                    borderRadius: '0 0 10px 10px',
                                    overflow: 'hidden',
                                }}>
                                    {VOICE_ORDER.map(voice => {
                                        const list = byVoiceNoEligible[voice];
                                        if (!list.length) return null;
                                        const color = VOICE_COLORS[voice];
                                        return (
                                            <div key={voice}>
                                                <div style={{
                                                    padding: '6px 14px', background: '#F9F9FB',
                                                    fontSize: '0.72rem', fontWeight: 700,
                                                    color, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    borderTop: '1px solid #F0F0F0',
                                                }}>
                                                    {VOICE_LABELS[voice]} ({list.length})
                                                </div>
                                                {list.map(item => (
                                                    <MemberRow key={item.member.id} item={item} isEligible={false} />
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {noElegibles === 0 && (
                                        <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                            ¡Todos cumplen los requisitos!
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── TAB: AUDITORÍA ── */}
                {activeTab === 'auditoria' && (
                    <>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Registro de asistencias de la semana — {weekLabel}
                        </p>
                        {auditData.length === 0 ? (
                            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin registros esta semana</p>
                            </div>
                        ) : (
                            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                {[...auditData].reverse().map((entry, idx) => {
                                    const d = new Date(entry.date);
                                    const dayLabel = DAY_NAMES[d.getUTCDay()];
                                    const dateLabel = `${dayLabel} ${d.getUTCDate()}`;
                                    const sessionMeta: Record<string, { label: string; emoji: string }> = {
                                        am_prayer: { label: 'Oración 5am', emoji: '🌅' },
                                        pm_prayer: { label: 'Oración 6pm', emoji: '🌙' },
                                        rehearsal: { label: 'Ensayo', emoji: '🎵' },
                                    };
                                    const meta = sessionMeta[entry.type] ?? { label: entry.type, emoji: '📋' };
                                    return (
                                        <div key={idx} style={{
                                            padding: '12px 16px',
                                            borderBottom: idx < auditData.length - 1 ? '1px solid var(--card-border)' : 'none',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>
                                                    {meta.emoji} {meta.label}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    {dateLabel}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {entry.lastSavedBy
                                                        ? `Registrado por ${entry.lastSavedBy}${entry.updatedAt ? ` · ${toGuatemalaTime(entry.updatedAt)}` : ''}`
                                                        : '—'}
                                                </div>
                                            </div>
                                            <div style={{
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                fontSize: '1.4rem',
                                                color: entry.presentCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                            }}>
                                                {entry.presentCount}
                                                <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>presentes</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Nav inferior */}
            <div style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: '430px',
                background: 'rgba(255,255,255,0.97)',
                borderTop: '1px solid var(--card-border)',
                display: 'flex', backdropFilter: 'blur(8px)', zIndex: 20,
            }}>
                {[
                    { tab: 'semana' as const, icon: <ClipboardList size={20} />, label: 'Esta semana' },
                    { tab: 'elegibles' as const, icon: <Star size={20} />, label: 'Elegibles' },
                    { tab: 'auditoria' as const, icon: <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>📋</span>, label: 'Auditoría' },
                ].map(({ tab, icon, label }) => (
                    <div
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: '4px', cursor: 'pointer',
                            borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        }}
                    >
                        <span style={{ color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            {icon}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: activeTab === tab ? 600 : 400 }}>
                            {label}
                        </span>
                    </div>
                ))}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
