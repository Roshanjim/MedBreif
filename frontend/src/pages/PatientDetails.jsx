import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api/client';
import { useAuth } from '../context/AuthContext';
import UploadReport from '../components/UploadReport';

export default function PatientDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patient, setPatient] = useState(null);
    const [visits, setVisits] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditingHistory, setIsEditingHistory] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

    useEffect(() => {
        fetchPatientData();
    }, [id]);

    const fetchPatientData = async () => {
        try {
            const data = await api.getPatient(id);
            setPatient(data.patient);
            setVisits(data.visits || []);
            setReports(data.reports || []);
            setEditForm(data.patient.medical_history || {});
            setLoading(false);
        } catch (err) {
            console.error('Failed to load patient:', err);
            setLoading(false);
        }
    };

    const handleSaveHistory = async () => {
        setSaving(true);
        try {
            const { patient: updatedPatient } = await api.updatePatient(id, { medical_history: editForm });
            setPatient(updatedPatient);
            setIsEditingHistory(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save medical history');
        }
        setSaving(false);
    };

    const handleReportUploaded = () => {
        fetchPatientData();
        setShowUpload(false);
    };

    const deleteReport = async (reportId) => {
        if (!window.confirm('Delete this report?')) return;
        try {
            await api.deleteReport(reportId);
            setReports(reports.filter(r => r.id !== reportId));
        } catch (err) {
            alert('Failed to delete report');
        }
    };

    const historyFields = [
        { key: 'allergies', label: 'Allergies' },
        { key: 'chronicConditions', label: 'Chronic Conditions' },
        { key: 'currentMedications', label: 'Current Medications' },
        { key: 'pastSurgeries', label: 'Past Surgeries / Hospitalizations' },
        { key: 'familyHistory', label: 'Family History' },
        { key: 'generalNotes', label: 'General Notes' }
    ];

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading patient details...</p></div>;
    }

    if (!patient) {
        return (
            <div>
                <h2>Patient not found</h2>
                <button className="btn btn-ghost" onClick={() => navigate('/patients')}>Back to Directory</button>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/patients')}>← Back</button>
                    <div>
                        <h1 className="page-title">{patient.name}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid var(--primary-color)' }}>
                                ID: {patient.patient_uid}
                            </div>
                            <span style={{ color: 'var(--text-muted)' }}>
                                {patient.age ? `${patient.age} yrs` : 'Age unknown'} {patient.gender ? `• ${patient.gender}` : ''}
                            </span>
                        </div>
                    </div>
                </div>
                {user?.role !== 'patient' && (
                    <button className="btn btn-primary" onClick={() => navigate('/new', { state: { patientId: patient.id, patientName: patient.name } })}>
                        + New Consultation
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                
                {/* Left Column: Medical History */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ color: 'var(--primary-color)', margin: 0 }}>Full Medical History</h3>
                        {!isEditingHistory ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingHistory(true)}>✎ Edit</button>
                        ) : (
                            <div>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setIsEditingHistory(false); setEditForm(patient.medical_history || {}); }}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSaveHistory} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {historyFields.map(field => (
                            <div key={field.key}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{field.label}</div>
                                {isEditingHistory ? (
                                    <textarea 
                                        className="input" 
                                        rows="2"
                                        value={editForm?.[field.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                    />
                                ) : (
                                    <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', minHeight: '40px', fontSize: '0.95rem' }}>
                                        {patient.medical_history?.[field.key] || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None recorded</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Visits and Reports */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    
                    {/* Patient Reports */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>📎 General Medical Reports</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(!showUpload)}>
                                {showUpload ? '▲ Hide' : '+ Upload Report'}
                            </button>
                        </div>
                        
                        {showUpload && (
                            <div style={{ marginBottom: 16 }}>
                                {/* Note: We are using a generic upload box here for patient reports */}
                                <UploadReport patientId={patient.id} onUploadComplete={handleReportUploaded} />
                            </div>
                        )}

                        {reports.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>No reports uploaded yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {reports.map(r => (
                                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ fontSize: '1.5rem' }}>📄</div>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{r.report_type}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.original_filename}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <a href={`${API_BASE}/reports/${r.id}/file?token=${localStorage.getItem('medbrief_token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View</a>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => deleteReport(r.id)}>🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Past Consultations */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>🎙️ Past Consultations</h3>
                        {visits.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>No consultations recorded yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {visits.map(v => (
                                    <div key={v.id} className="visit-card" onClick={() => navigate(user?.role === 'patient' ? `/visit/${v.id}` : `/visit/${v.id}/summary`)} style={{ cursor: 'pointer', margin: 0 }}>
                                        <div className="visit-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div className="visit-date" style={{ fontWeight: 600 }}>{new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    👨‍⚕️ {v.doctor_name || 'Attending Physician'} {v.hospital_name ? `• 🏥 ${v.hospital_name}` : ''}
                                                </div>
                                            </div>
                                            <span className={`status-badge status-${v.status}`}>
                                                {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
