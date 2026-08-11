import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login, register, patientLogin, patientRegister } = useAuth();
    
    // Auth Mode: 'doctor' | 'patient'
    const [authMode, setAuthMode] = useState('doctor');
    
    // View Mode: 'login' | 'register'
    const [viewMode, setViewMode] = useState('login');
    
    // Doctor Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('doctor');

    // Patient Form State
    const [patientUid, setPatientUid] = useState('');
    const [patientName, setPatientName] = useState('');
    
    // Patient Registration State
    const [patientData, setPatientData] = useState({
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

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePatientHistoryChange = (field, value) => {
        setPatientData(prev => ({
            ...prev,
            medical_history: {
                ...prev.medical_history,
                [field]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (authMode === 'doctor') {
                if (viewMode === 'register') {
                    await register(name, email, password, role);
                } else {
                    await login(email, password);
                }
            } else {
                if (viewMode === 'register') {
                    await patientRegister({
                        ...patientData,
                        age: patientData.age ? parseInt(patientData.age) : null
                    });
                } else {
                    await patientLogin(patientUid, patientName);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card fade-in" style={{ maxWidth: viewMode === 'register' && authMode === 'patient' ? '600px' : '400px', width: '100%' }}>
                <div className="login-header">
                    <div className="login-icon">🏥</div>
                    <h1>MedBrief AI</h1>
                    <p>{viewMode === 'register' ? 'Create your account' : 'Sign in to your account'}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                    <button 
                        type="button"
                        onClick={() => { setAuthMode('doctor'); setError(''); }}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: authMode === 'doctor' ? 'var(--bg-primary)' : 'transparent', color: authMode === 'doctor' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: authMode === 'doctor' ? '600' : 'normal', cursor: 'pointer', boxShadow: authMode === 'doctor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                    >
                        👨‍⚕️ Doctor
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setAuthMode('patient'); setError(''); }}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: authMode === 'patient' ? 'var(--bg-primary)' : 'transparent', color: authMode === 'patient' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: authMode === 'patient' ? '600' : 'normal', cursor: 'pointer', boxShadow: authMode === 'patient' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                    >
                        🤒 Patient
                    </button>
                </div>

                {error && (
                    <div className="disclaimer-banner" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    
                    {/* DOCTOR LOGIN / REGISTER */}
                    {authMode === 'doctor' && (
                        <>
                            {viewMode === 'register' && (
                                <div className="input-group">
                                    <label>Full Name</label>
                                    <input type="text" className="input" placeholder="Dr. John Doe" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                            )}

                            <div className="input-group">
                                <label>Email</label>
                                <input type="email" className="input" placeholder="doctor@hospital.com" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>

                            <div className="input-group">
                                <label>Password</label>
                                <input type="password" className="input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                            </div>

                            {viewMode === 'register' && (
                                <div className="input-group">
                                    <label>Role</label>
                                    <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                                        <option value="doctor">Doctor</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {/* PATIENT LOGIN */}
                    {authMode === 'patient' && viewMode === 'login' && (
                        <>
                            <div className="input-group">
                                <label>Patient ID</label>
                                <input type="text" className="input" placeholder="e.g. PAT-1A2B3C" value={patientUid} onChange={e => setPatientUid(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" className="input" placeholder="John Doe" value={patientName} onChange={e => setPatientName(e.target.value)} required />
                            </div>
                        </>
                    )}

                    {/* PATIENT REGISTER */}
                    {authMode === 'patient' && viewMode === 'register' && (
                        <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '12px', margin: '-12px -12px 12px 0', padding: '12px' }}>
                            <div className="input-group">
                                <label>Full Name *</label>
                                <input type="text" className="input" required value={patientData.name} onChange={e => setPatientData(prev => ({ ...prev, name: e.target.value }))} placeholder="John Doe" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="input-group">
                                    <label>Age</label>
                                    <input type="number" className="input" value={patientData.age} onChange={e => setPatientData(prev => ({ ...prev, age: e.target.value }))} placeholder="e.g. 45" />
                                </div>
                                <div className="input-group">
                                    <label>Gender</label>
                                    <select className="input" value={patientData.gender} onChange={e => setPatientData(prev => ({ ...prev, gender: e.target.value }))}>
                                        <option value="">Select Gender...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <hr style={{ margin: '16px 0', borderColor: 'var(--border-color)' }} />
                            <div className="input-group">
                                <label>Known Allergies</label>
                                <textarea className="input" rows="2" value={patientData.medical_history.allergies} onChange={e => handlePatientHistoryChange('allergies', e.target.value)} placeholder="e.g. Penicillin (or 'None known')" />
                            </div>
                            <div className="input-group">
                                <label>Chronic Conditions</label>
                                <textarea className="input" rows="2" value={patientData.medical_history.chronicConditions} onChange={e => handlePatientHistoryChange('chronicConditions', e.target.value)} placeholder="e.g. Hypertension" />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: '12px' }}>
                        {loading ? '⏳ Processing...' : (viewMode === 'register' ? (authMode === 'patient' ? '🚀 Register as Patient' : '🚀 Create Account') : '🔐 Sign In')}
                    </button>
                </form>

                <div className="login-toggle">
                    {viewMode === 'register' ? 'Already have an account? ' : "Don't have an account? "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setViewMode(viewMode === 'register' ? 'login' : 'register'); setError(''); }}>
                        {viewMode === 'register' ? 'Sign In' : (authMode === 'patient' ? 'Register as Patient' : 'Sign Up')}
                    </a>
                </div>
            </div>
        </div>
    );
}
