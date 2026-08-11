import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

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
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('dashboard.title', 'Dashboard')}</h1>
                    <p className="page-subtitle">{t('dashboard.subtitle', 'Manage your consultation summaries')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/new')}>
                    ➕ {t('dashboard.newConsultation', 'New Consultation')}
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">📋</div>
                    <div>
                        <div className="stat-value">{totalVisits}</div>
                        <div className="stat-label">Total Visits</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div>
                        <div className="stat-value">{finalized}</div>
                        <div className="stat-label">Finalized</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow">⏳</div>
                    <div>
                        <div className="stat-value">{inProgress}</div>
                        <div className="stat-label">In Progress</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon purple">🎯</div>
                    <div>
                        <div className="stat-value">{avgConfidence}%</div>
                        <div className="stat-label">Avg Confidence</div>
                    </div>
                </div>
            </div>

            <h2 style={{ marginBottom: 16 }}>{t('dashboard.recentConsultations', 'Recent Consultations')}</h2>

            {visits.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-state-icon">🩺</div>
                    <h3>{t('dashboard.noConsultations', 'No consultations yet')}</h3>
                    <p style={{ marginBottom: 20 }}>{t('dashboard.startFirst', 'Start your first AI-powered consultation recording')}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/new')}>
                        🎙️ {t('dashboard.startRecording', 'Start Recording')}
                    </button>
                </div>
            ) : (
                <div className="visits-list">
                    {visits.map(visit => (
                        <Link key={visit.id} to={getVisitLink(visit)} className="visit-card">
                            <div className="visit-icon">{statusIcons[visit.status] || '📋'}</div>
                            <div className="visit-info">
                                <div className="visit-patient">{visit.patient_name}</div>
                                <div className="visit-date">{new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            </div>
                            <div className="visit-meta">
                                {visit.confidence_score > 0 && (
                                    <span className={`confidence-badge ${visit.confidence_score >= 80 ? 'confidence-high' : visit.confidence_score >= 60 ? 'confidence-medium' : 'confidence-low'}`}>
                                        🎯 {visit.confidence_score}%
                                    </span>
                                )}
                                <span className={`badge ${statusColors[visit.status]}`}>
                                    {visit.status}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
