import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user } = useAuth();

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Configure your MedBrief AI preferences</p>
                </div>
            </div>

            <div className="settings-section">
                <h3>👤 Profile</h3>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                        <div className="user-avatar" style={{ width: 64, height: 64, fontSize: '1.4rem' }}>
                            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                        </div>
                        <div>
                            <h2>{user?.name || 'Doctor'}</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
                            <span className="badge badge-primary" style={{ marginTop: 4 }}>{user?.role}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>🌐 Language Preferences</h3>
                <div className="card">
                    <div className="input-group" style={{ marginBottom: 16 }}>
                        <label>Summary Language</label>
                        <select className="input">
                            <option value="en">English</option>
                            <option value="ml">Malayalam</option>
                            <option value="hi">Hindi</option>
                        </select>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        🔮 Translation feature coming soon. Summaries will be generated in the selected language.
                    </p>
                </div>
            </div>

            <div className="settings-section">
                <h3>🔒 Security</h3>
                <div className="card">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                        All medical data is encrypted and stored securely. This application follows HIPAA-style compliance guidelines.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-success">🔐 Encrypted Storage</span>
                        <span className="badge badge-success">🛡️ JWT Authentication</span>
                        <span className="badge badge-primary">📋 Audit Logging</span>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>🔮 Future Features</h3>
                <div className="card">
                    <div className="summary-items">
                        <div className="summary-item"><span className="summary-item-icon">🏷️</span> ICD-10 Code Auto-Detection</div>
                        <div className="summary-item"><span className="summary-item-icon">💊</span> Drug Interaction Detection</div>
                        <div className="summary-item"><span className="summary-item-icon">🏥</span> EHR Integration API</div>
                        <div className="summary-item"><span className="summary-item-icon">🔔</span> Follow-up Reminder System</div>
                        <div className="summary-item"><span className="summary-item-icon">📊</span> Analytics Dashboard</div>
                    </div>
                </div>
            </div>

            <div className="disclaimer-banner" style={{ marginTop: 32 }}>
                <span className="disclaimer-icon">⚕️</span>
                <span>MedBrief AI v1.0 Prototype — AI-generated summaries require doctor verification.</span>
            </div>
        </div>
    );
}
