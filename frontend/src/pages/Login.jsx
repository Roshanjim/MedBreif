import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('doctor');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegister) {
                await register(name, email, password, role);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card fade-in">
                <div className="login-header">
                    <div className="login-icon">🏥</div>
                    <h1>MedBrief AI</h1>
                    <p>{isRegister ? 'Create your account' : 'Sign in to your account'}</p>
                </div>

                {error && (
                    <div className="disclaimer-banner" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="input-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Dr. John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="doctor@hospital.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {isRegister && (
                        <div className="input-group">
                            <label>Role</label>
                            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                                <option value="doctor">Doctor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? '⏳ Processing...' : (isRegister ? '🚀 Create Account' : '🔐 Sign In')}
                    </button>
                </form>

                <div className="login-toggle">
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister); setError(''); }}>
                        {isRegister ? 'Sign In' : 'Sign Up'}
                    </a>
                </div>
            </div>
        </div>
    );
}
