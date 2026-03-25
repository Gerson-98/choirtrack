import { useState, useEffect } from 'react';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from './api';

interface EligibilityItem {
    member: { id: number; name: string; voice: string };
    isEligible: boolean;
}

const VOICE_ORDER = ['soprano', 'segunda', 'tenor', 'bajo'];
const VOICE_LABELS: Record<string, string> = {
    soprano: 'Sopranos', segunda: 'Segundas', tenor: 'Tenores', bajo: 'Bajos',
};
const VOICE_COLORS: Record<string, string> = {
    soprano: '#c4429a', segunda: '#2d7dd2', tenor: '#0d9e6e', bajo: '#b45309',
};

export default function Presentacion() {
    const [data, setData] = useState<EligibilityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const today = new Date();
    const sunday = startOfWeek(today, { weekStartsOn: 0 });
    const sundayLabel = format(sunday, "d 'de' MMMM, yyyy", { locale: es });

    useEffect(() => {
        api.get(`/eligibility/${today.toISOString()}`)
            .then(res => { setData(res.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const byVoiceEl: Record<string, EligibilityItem[]> = {};
    const byVoiceNo: Record<string, EligibilityItem[]> = {};
    for (const v of VOICE_ORDER) { byVoiceEl[v] = []; byVoiceNo[v] = []; }
    for (const item of data) {
        const v = item.member.voice in byVoiceEl ? item.member.voice : 'soprano';
        if (item.isEligible) byVoiceEl[v].push(item);
        else byVoiceNo[v].push(item);
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, width: '100vw', height: '100vh',
            background: '#F7F5F2', overflowY: 'auto',
            fontFamily: 'Inter, sans-serif',
            zIndex: 100,
        }}>
            {/* Salir */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    position: 'fixed', top: '16px', left: '16px',
                    background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', cursor: 'pointer', fontSize: '0.88rem',
                    color: '#555', zIndex: 110,
                }}
            >
                ← Salir
            </button>

            {/* Título */}
            <div style={{ textAlign: 'center', padding: '48px 24px 28px' }}>
                <div style={{ fontSize: '0.95rem', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Escuela Dominical
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#1A1A2E', textTransform: 'capitalize' }}>
                    {sundayLabel}
                </div>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Cargando…</p>
            ) : (
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    maxWidth: '1100px', margin: '0 auto', padding: '0 32px 64px',
                    gap: '0',
                }}>
                    {/* SUBEN */}
                    <div style={{ paddingRight: '32px', borderRight: '2px solid #E5E7EB' }}>
                        <div style={{
                            fontSize: '1.05rem', fontWeight: 700, color: '#10B981',
                            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            ✅ SUBEN
                        </div>
                        {VOICE_ORDER.map(voice => {
                            const list = byVoiceEl[voice];
                            if (!list.length) return null;
                            return (
                                <div key={voice} style={{ marginBottom: '20px' }}>
                                    <div style={{
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: VOICE_COLORS[voice],
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        marginBottom: '8px',
                                    }}>
                                        {VOICE_LABELS[voice]}
                                    </div>
                                    {list.map(item => (
                                        <div key={item.member.id} style={{
                                            fontSize: '1.4rem', fontWeight: 500, color: '#1A1A2E',
                                            padding: '7px 0',
                                            borderBottom: '1px solid #EEE',
                                        }}>
                                            {item.member.name}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {/* NO SUBEN */}
                    <div style={{ paddingLeft: '32px' }}>
                        <div style={{
                            fontSize: '1.05rem', fontWeight: 700, color: '#EF4444',
                            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            ❌ NO SUBEN
                        </div>
                        {VOICE_ORDER.map(voice => {
                            const list = byVoiceNo[voice];
                            if (!list.length) return null;
                            return (
                                <div key={voice} style={{ marginBottom: '20px' }}>
                                    <div style={{
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: VOICE_COLORS[voice],
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        marginBottom: '8px',
                                    }}>
                                        {VOICE_LABELS[voice]}
                                    </div>
                                    {list.map(item => (
                                        <div key={item.member.id} style={{
                                            fontSize: '1.4rem', fontWeight: 400, color: '#9CA3AF',
                                            padding: '7px 0',
                                            borderBottom: '1px solid #EEE',
                                        }}>
                                            {item.member.name}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
