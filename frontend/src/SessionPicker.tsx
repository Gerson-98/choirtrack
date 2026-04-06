import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './api';

interface Props {
    onLogout: () => void;
}

interface SessionStatus {
    loading: boolean;
    count: number | null;
}

export default function SessionPicker({ onLogout }: Props) {
    const navigate = useNavigate();
    const fechaHoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

    const [amStatus, setAmStatus] = useState<SessionStatus>({ loading: true, count: null });
    const [pmStatus, setPmStatus] = useState<SessionStatus>({ loading: true, count: null });
    const [morningStatus, setMorningStatus] = useState<SessionStatus>({ loading: true, count: null });

    useEffect(() => {
        async function checkSessions() {
            try {
                const res = await api.get('/director/today');
                const sessions: { type: string; count: number }[] = res.data.sessions;
                const am = sessions.find(s => s.type === 'am_prayer');
                const pm = sessions.find(s => s.type === 'pm_prayer');
                const morning = sessions.find(s => s.type === 'morning_prayer');
                setAmStatus({ loading: false, count: am?.count ?? 0 });
                setPmStatus({ loading: false, count: pm?.count ?? 0 });
                setMorningStatus({ loading: false, count: morning?.count ?? 0 });
            } catch {
                setAmStatus({ loading: false, count: null });
                setPmStatus({ loading: false, count: null });
                setMorningStatus({ loading: false, count: null });
            }
        }
        checkSessions();
    }, []);

    const StatusBadge = ({ status }: { status: SessionStatus }) => {
        if (status.loading) {
            return (
                <span style={{
                    fontSize: '0.72rem', padding: '3px 9px', borderRadius: '20px',
                    background: '#F0EEF8', color: 'var(--text-muted)',
                    border: '1px solid #E5E7EB',
                }}>
                    Verificando…
                </span>
            );
        }
        if (status.count !== null && status.count > 0) {
            return (
                <span style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
                    background: 'rgba(16,185,129,0.12)', color: '#10B981',
                    border: '1px solid rgba(16,185,129,0.3)',
                }}>
                    ✓ Ya registrada · {status.count} presentes
                </span>
            );
        }
        return (
            <span style={{
                fontSize: '0.72rem', padding: '3px 9px', borderRadius: '20px',
                background: '#F3F4F6', color: 'var(--text-muted)',
                border: '1px solid #E5E7EB',
            }}>
                Sin registro
            </span>
        );
    };

    return (
        <>
            <div className="header-bar">
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>🙏 Oraciones</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {fechaHoy}
                    </p>
                </div>
                <LogOut
                    size={20}
                    style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={onLogout}
                />
            </div>

            <div className="container" style={{ justifyContent: 'center', paddingTop: '40px', gap: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '8px' }}>
                    ¿Qué oración vas a registrar?
                </p>

                {/* Botón Oración 5am */}
                <button
                    onClick={() => navigate('/session/am_prayer')}
                    style={{
                        width: '100%',
                        padding: '24px 20px',
                        borderRadius: '16px',
                        background: '#FFFFFF',
                        border: '1.5px solid rgba(212,112,176,0.4)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(212,112,176,0.06)')}
                    onMouseOut={e => (e.currentTarget.style.background = '#FFFFFF')}
                >
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: '#6C63FF', color: '#fff',
                        fontWeight: 700, fontSize: '1rem',
                        borderRadius: '8px', padding: '8px 12px',
                        width: '56px', textAlign: 'center', flexShrink: 0,
                    }}>5AM</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                            Oración 5am
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Requisito: asistir al menos 1 vez por semana
                        </div>
                        <StatusBadge status={amStatus} />
                    </div>
                </button>

                {/* Botón Oración 6pm */}
                <button
                    onClick={() => navigate('/session/pm_prayer')}
                    style={{
                        width: '100%',
                        padding: '24px 20px',
                        borderRadius: '16px',
                        background: '#FFFFFF',
                        border: '1.5px solid rgba(74,158,245,0.4)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(74,158,245,0.06)')}
                    onMouseOut={e => (e.currentTarget.style.background = '#FFFFFF')}
                >
                    <span style={{ fontSize: '2.4rem' }}>🌙</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                            Oración 6pm
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Requisito: asistir al menos 4 veces por semana
                        </div>
                        <StatusBadge status={pmStatus} />
                    </div>
                </button>

                {/* Botón Oración 9am (solo mujeres) */}
                <button
                    onClick={() => navigate('/session/morning_prayer')}
                    style={{
                        width: '100%',
                        padding: '24px 20px',
                        borderRadius: '16px',
                        background: '#FFFFFF',
                        border: '1.5px solid rgba(240,180,50,0.4)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(240,180,50,0.06)')}
                    onMouseOut={e => (e.currentTarget.style.background = '#FFFFFF')}
                >
                    <span style={{ fontSize: '2.4rem' }}>☀️</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                            Oración 9am
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Solo mujeres · Combinada con 6pm para requisito semanal
                        </div>
                        <StatusBadge status={morningStatus} />
                    </div>
                </button>
            </div>
        </>
    );
}
