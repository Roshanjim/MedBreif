import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { IconNewConsultation, IconFileText, IconCheck, IconStethoscope, IconMicrophone } from '../components/Icons';

export default function Dashboard() {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { t } = useTranslation();

    useEffect(() => {
        api.getVisits()
            .then(data => { setVisits(data.visits); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const statusColors = {
        recording: 'badge-primary',
        transcribing: 'badge-warning',
        reviewing: 'badge-success',
        finalized: 'badge-success',
    };

    const statusIcons = {
        recording: '🎙️',
        transcribing: '⏳',
        reviewing: '📝',
        finalized: '✅',
    };

    const getVisitLink = (visit) => {
        switch (visit.status) {
            case 'recording': return `/new`;
            case 'transcribing': return `/visit/${visit.id}/transcript`;
            case 'reviewing': return `/visit/${visit.id}/summary`;
            case 'finalized': return `/visit/${visit.id}/review`;
            default: return `/visit/${visit.id}/transcript`;
        }
    };

    const totalVisits = visits.length;
    const finalized = visits.filter(v => v.status === 'finalized').length;
    const inProgress = visits.filter(v => v.status !== 'finalized').length;
    const avgConfidence = visits.filter(v => v.confidence_score).length > 0
        ? Math.round(visits.filter(v => v.confidence_score).reduce((a, v) => a + v.confidence_score, 0) / visits.filter(v => v.confidence_score).length)
        : 0;

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading visits...</p></div>;
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('dashboard.title', 'Clinical Dashboard')}</h1>
                    <p className="page-subtitle">{t('dashboard.subtitle', 'Patient consultation summaries and clinical documentation')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/new')}>
                    <IconNewConsultation size={18} /> {t('dashboard.newConsultation', 'New Consultation')}
                </button>
            </div>

            {/* Hero Section with Realistic Doctor Photo */}
            <div className="hero-banner">
                <div className="hero-content">
                    <span className="badge badge-primary" style={{ marginBottom: 12 }}>Clinical Record Management</span>
                    <h2>Streamlined Consultation Notes & Patient Summaries</h2>
                    <p>
                        Capture physician-patient dialogues naturally. Record consultation sessions to generate 
                        verified clinical summaries, structured SOAP notes, and accessible patient record briefs.
                    </p>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-primary" onClick={() => navigate('/new')}>
                            <IconMicrophone size={18} /> Begin Consultation Recording
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate('/patients')}>
                            View Patient Registry
                        </button>
                    </div>
                </div>
                <div className="hero-image-wrapper">
                    <img src="/images/hero_doctor.png" alt="Physician consulting with patient in modern clinical setting" />
                </div>
            </div>

            <h2 style={{ marginBottom: 16 }}>{t('dashboard.recentConsultations', 'Recent Consultations')}</h2>

            {visits.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-state-icon"><IconStethoscope size={40} /></div>
                    <h3>{t('dashboard.noConsultations', 'No consultations recorded yet')}</h3>
                    <p style={{ marginBottom: 20 }}>{t('dashboard.startFirst', 'Start your first clinical consultation session')}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/new')}>
                        <IconNewConsultation size={18} /> {t('dashboard.startRecording', 'Start Consultation')}
                    </button>
                </div>
            ) : (
                <div className="visits-list">
                    {visits.map(visit => (
                        <Link key={visit.id} to={getVisitLink(visit)} className="visit-card">
                            <div className="visit-icon"><IconStethoscope size={20} /></div>
                            <div className="visit-info">
                                <div className="visit-patient">{visit.patient_name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    👨‍⚕️ {visit.doctor_name || 'Attending Physician'} {visit.hospital_name ? `• 🏥 ${visit.hospital_name}` : ''}
                                </div>
                            </div>
                            <div className="visit-meta">
                                <span className="visit-date">{new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className={`badge ${statusColors[visit.status]}`}>
                                    {visit.status}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Dark Teal Clinical Information Section */}
            <div className="info-section-dark">
                <div>
                    <h3>Integrated Clinical Workflow & Patient Access</h3>
                    <p>
                        Consultation summaries verified by attending physicians are instantly synced 
                        to patient profiles. Both healthcare providers and patients receive clear, language-adapted summaries.
                    </p>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                    <h4 style={{ color: '#ffffff', marginBottom: 8, fontSize: '1rem' }}>🔒 Clinical Data Protocol</h4>
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                        All summaries require doctor digital sign-off prior to clinical placement. Multi-hospital consultation records remain unified per patient.
                    </p>
                </div>
            </div>

            {/* Split Feature Section with Team Photo */}
            <div className="split-feature-section">
                <div className="split-feature-image">
                    <img src="/images/medical_team.png" alt="Clinical healthcare team collaborating in medical center" />
                </div>
                <div>
                    <span className="badge badge-primary" style={{ marginBottom: 12 }}>Collaborative Care</span>
                    <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: 12 }}>Cross-Specialty Medical Continuity</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 16 }}>
                        Doctors across different participating hospitals can review a patient's historical consultation briefs, diagnostic test results, and SOAP notes seamlessly.
                    </p>
                    <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
                        Manage Profile & Hospital Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
