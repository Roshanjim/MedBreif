import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { IconDownload, IconCheck, IconStethoscope, IconHospital } from '../components/Icons';

export default function PatientVisitView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [visit, setVisit] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getVisit(id).then(res => {
            setVisit(res.visit);
            setData(res.visit.extracted_data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>{t('loading', 'Loading visit details...')}</p></div>;
    }

    if (!visit) {
        return (
            <div className="empty-state" style={{ marginTop: 60 }}>
                <div className="empty-state-icon">🩺</div>
                <h3>{t('visitNotFound', 'Visit not found')}</h3>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
                    {t('backToDashboard', 'Back to Dashboard')}
                </button>
            </div>
        );
    }

    const isFinalized = visit.status === 'finalized';

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('back', 'Back')}</button>
                    <div>
                        <h1 className="page-title">{t('consultationDetails', 'Consultation Details')}</h1>
                        <p className="page-subtitle">{new Date(visit.visit_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    {isFinalized && (
                        <button className="btn btn-secondary" onClick={() => {
                            const token = localStorage.getItem('medbrief_token');
                            fetch(`/api/pdf/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            }).then(res => res.blob()).then(blob => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Consultation_Report_${id}.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }).catch(err => alert('PDF download failed: ' + err.message));
                        }}>
                            <IconDownload size={16} /> {t('downloadPdf', 'Download PDF')}
                        </button>
                    )}
                </div>
            </div>

            {!isFinalized && (
                <div className="disclaimer-banner" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <span className="disclaimer-icon">⏳</span>
                    <span>{t('pendingVerification', 'This consultation summary is currently being reviewed by your doctor and has not been finalized yet.')}</span>
                </div>
            )}

            {isFinalized && (
                <div className="disclaimer-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <span className="disclaimer-icon">✅</span>
                    <span>{t('verifiedByDoctor', 'This summary has been verified and digitally signed by your doctor.')}</span>
                </div>
            )}

            <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="user-avatar" style={{ width: 44, height: 44, fontSize: '1rem', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                    <IconStethoscope size={22} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{visit.doctor_name || 'Attending Physician'}</h3>
                    <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconHospital size={14} /> {visit.hospital_name || 'Medical Center / Clinic'}
                    </p>
                </div>
            </div>

            <div className="two-col" style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>{t('patientSummary', 'Patient Summary')}</h3>
                        {visit.patient_summary ? (
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--text-primary)' }}>
                                {visit.patient_summary}
                            </pre>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>{t('noSummaryAvailable', 'No summary available yet.')}</p>
                        )}
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>{t('doctorNotes', 'Doctor\'s Notes')}</h3>
                        {visit.doctor_summary ? (
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--text-primary)' }}>
                                {visit.doctor_summary}
                            </pre>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>{t('noNotesAvailable', 'No notes available yet.')}</p>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {data && data.Prescriptions && data.Prescriptions.length > 0 && (
                        <div className="card">
                            <h3 style={{ marginBottom: 16 }}>{t('prescriptions', 'Prescriptions')}</h3>
                            <table className="medicine-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '8px 4px' }}>{t('medicine', 'Medicine')}</th>
                                        <th style={{ padding: '8px 4px' }}>{t('dosage', 'Dosage')}</th>
                                        <th style={{ padding: '8px 4px' }}>{t('frequency', 'Frequency')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.Prescriptions.map((rx, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <td style={{ padding: '12px 4px', fontWeight: 600 }}>{rx.Medicine}</td>
                                            <td style={{ padding: '12px 4px' }}>{rx.Dosage}</td>
                                            <td style={{ padding: '12px 4px' }}>{rx.Frequency} <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rx.Duration}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {data && data.LifestyleAdvice && data.LifestyleAdvice.length > 0 && (
                        <div className="card">
                            <h3 style={{ marginBottom: 16 }}>{t('lifestyleAdvice', 'Lifestyle Advice')}</h3>
                            <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                                {data.LifestyleAdvice.map((advice, i) => (
                                    <li key={i}>{advice}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {data && data.TestsAdvised && data.TestsAdvised.length > 0 && (
                        <div className="card">
                            <h3 style={{ marginBottom: 16 }}>{t('testsAdvised', 'Tests Advised')}</h3>
                            <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                                {data.TestsAdvised.map((test, i) => (
                                    <li key={i}>{test}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
