import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function EditReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [visit, setVisit] = useState(null);
    const [doctorSummary, setDoctorSummary] = useState('');
    const [patientSummary, setPatientSummary] = useState('');
    const [signed, setSigned] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getVisit(id).then(res => {
            setVisit(res.visit);
            setDoctorSummary(res.visit.doctor_summary || '');
            setPatientSummary(res.visit.patient_summary || '');
            setSigned(!!res.visit.doctor_signature);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateVisit(id, {
                doctor_summary: doctorSummary,
                patient_summary: patientSummary,
                status: 'reviewing',
            });
            alert('Changes saved!');
        } catch (err) {
            alert(err.message);
        }
        setSaving(false);
    };

    const handleFinalize = async () => {
        setSaving(true);
        try {
            await api.updateVisit(id, {
                doctor_summary: doctorSummary,
                patient_summary: patientSummary,
                doctor_signature: `digitally-signed-${Date.now()}`,
                status: 'finalized',
            });
            setSigned(true);
            alert('Visit finalized successfully!');
        } catch (err) {
            alert(err.message);
        }
        setSaving(false);
    };

    const handleDownloadPDF = () => {
        const token = localStorage.getItem('medbrief_token');
        fetch(`/api/pdf/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MedBrief_Visit_${id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(err => alert('PDF download failed: ' + err.message));
    };

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading review...</p></div>;
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Edit & Review</h1>
                    <p className="page-subtitle">{visit?.patient_name} – {visit?.visit_date}</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={() => navigate(`/visit/${id}/summary`)}>
                        ← Back to Summary
                    </button>
                    <button className="btn btn-secondary" onClick={handleDownloadPDF}>
                        📄 Download PDF
                    </button>
                </div>
            </div>

            <div className="disclaimer-banner">
                <span className="disclaimer-icon">⚕️</span>
                <span>AI-generated summary. Doctor verification required before clinical use.</span>
            </div>

            <div className="pipeline-steps">
                <div className="pipeline-step completed"><div className="pipeline-step-icon">🎙️</div><div className="pipeline-step-label">Recorded</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed"><div className="pipeline-step-icon">📝</div><div className="pipeline-step-label">Transcribed</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed"><div className="pipeline-step-icon">🧠</div><div className="pipeline-step-label">Extracted</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed"><div className="pipeline-step-icon">📋</div><div className="pipeline-step-label">Summary</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step active"><div className="pipeline-step-icon">✅</div><div className="pipeline-step-label">Review</div></div>
            </div>

            <div className="two-col" style={{ marginTop: 24 }}>
                <div>
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>🩺 Doctor Summary</h3>
                        <div className="editable-field">
                            <textarea
                                value={doctorSummary}
                                onChange={e => setDoctorSummary(e.target.value)}
                                style={{ minHeight: 300 }}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>🧑 Patient Summary</h3>
                        <div className="editable-field">
                            <textarea
                                value={patientSummary}
                                onChange={e => setPatientSummary(e.target.value)}
                                style={{ minHeight: 300 }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 16 }}>✍️ Digital Signature</h3>
                <div
                    className={`signature-area ${signed ? 'signed' : ''}`}
                    onClick={() => !signed && handleFinalize()}
                >
                    {signed ? (
                        <>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                            <div style={{ fontWeight: 600 }}>Digitally Signed & Finalized</div>
                            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Visit has been verified by the attending physician</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✍️</div>
                            <div style={{ fontWeight: 500 }}>Click to sign and finalize</div>
                            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>This will mark the visit as verified</div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => navigate('/')}>
                    🏠 Back to Dashboard
                </button>
                <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
                {!signed && (
                    <button className="btn btn-success" onClick={handleFinalize} disabled={saving}>
                        {saving ? '⏳ Finalizing...' : '✅ Sign & Finalize'}
                    </button>
                )}
            </div>
        </div>
    );
}
