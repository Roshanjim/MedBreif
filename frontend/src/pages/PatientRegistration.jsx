import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function PatientRegistration() {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        gender: '',
        medical_history: {
            allergies: '',
            chronicConditions: '',
            pastSurgeries: '',
            familyHistory: '',
            currentMedications: '',
            generalNotes: ''
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleHistoryChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            medical_history: {
                ...prev.medical_history,
                [field]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const { patient } = await api.createPatient({
                ...formData,
                age: formData.age ? parseInt(formData.age) : null
            });
            navigate(`/patients/${patient.id}`);
        } catch (err) {
            setError(err.message || 'Failed to register patient');
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="btn btn-ghost" onClick={() => navigate('/patients')}>← Back</button>
                <div>
                    <h1 className="page-title">Register Patient</h1>
                    <p className="page-subtitle">Add a new patient to your directory</p>
                </div>
            </div>

            {error && (
                <div className="disclaimer-banner" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginBottom: 24 }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card">
                <h3 style={{ marginBottom: 16, color: 'var(--primary-color)' }}>Basic Information</h3>
                
                <div className="input-group">
                    <label>Full Name *</label>
                    <input 
                        type="text" 
                        className="input" 
                        required
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                    />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="input-group">
                        <label>Age</label>
                        <input 
                            type="number" 
                            className="input" 
                            value={formData.age}
                            onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                            placeholder="e.g. 45"
                        />
                    </div>
                    <div className="input-group">
                        <label>Gender</label>
                        <select 
                            className="input"
                            value={formData.gender}
                            onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                        >
                            <option value="">Select Gender...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <hr style={{ margin: '32px 0', borderColor: 'var(--border-color)' }} />
                
                <h3 style={{ marginBottom: 16, color: 'var(--primary-color)' }}>Medical History (One-time Entry)</h3>
                
                <div className="input-group">
                    <label>Known Allergies</label>
                    <textarea 
                        className="input" 
                        rows="2"
                        value={formData.medical_history.allergies}
                        onChange={e => handleHistoryChange('allergies', e.target.value)}
                        placeholder="e.g. Penicillin, Peanuts (or 'None known')"
                    />
                </div>

                <div className="input-group">
                    <label>Chronic Conditions</label>
                    <textarea 
                        className="input" 
                        rows="2"
                        value={formData.medical_history.chronicConditions}
                        onChange={e => handleHistoryChange('chronicConditions', e.target.value)}
                        placeholder="e.g. Hypertension, Type 2 Diabetes"
                    />
                </div>

                <div className="input-group">
                    <label>Current Medications</label>
                    <textarea 
                        className="input" 
                        rows="2"
                        value={formData.medical_history.currentMedications}
                        onChange={e => handleHistoryChange('currentMedications', e.target.value)}
                        placeholder="e.g. Metformin 500mg daily"
                    />
                </div>

                <div className="input-group">
                    <label>Past Surgeries / Hospitalizations</label>
                    <textarea 
                        className="input" 
                        rows="2"
                        value={formData.medical_history.pastSurgeries}
                        onChange={e => handleHistoryChange('pastSurgeries', e.target.value)}
                        placeholder="e.g. Appendectomy (2015)"
                    />
                </div>

                <div className="input-group">
                    <label>Family Medical History</label>
                    <textarea 
                        className="input" 
                        rows="2"
                        value={formData.medical_history.familyHistory}
                        onChange={e => handleHistoryChange('familyHistory', e.target.value)}
                        placeholder="e.g. Father: Heart Disease"
                    />
                </div>

                <div className="input-group">
                    <label>General Notes</label>
                    <textarea 
                        className="input" 
                        rows="3"
                        value={formData.medical_history.generalNotes}
                        onChange={e => handleHistoryChange('generalNotes', e.target.value)}
                        placeholder="Any other important patient context..."
                    />
                </div>

                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : 'Register Patient'}
                    </button>
                </div>
            </form>
        </div>
    );
}
