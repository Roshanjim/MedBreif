import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { IconSettings, IconStethoscope, IconHospital, IconCheck, IconAlert } from '../components/Icons';

export default function Settings() {
    const { user, updateUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [hospitalName, setHospitalName] = useState(user?.hospital_name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setHospitalName(user.hospital_name || '');
        }
    }, [user]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');
        try {
            const data = await api.updateProfile({ name, hospital_name: hospitalName });
            updateUser(data.user);
            setMessage('Profile and facility details updated successfully.');
        } catch (err) {
            setError(err.message || 'Failed to update profile details');
        }
        setSaving(false);
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Account & Clinical Settings</h1>
                    <p className="page-subtitle">Manage physician credentials, practice affiliations, and security protocols</p>
                </div>
            </div>

            {user?.role !== 'patient' && (
                <div className="settings-section">
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-teal)', marginBottom: 16 }}>Physician & Facility Profile</h3>
                    <div className="card">
                        {message && (
                            <div className="disclaimer-banner" style={{ marginBottom: 20, background: '#dcfce7', borderColor: '#15803d', color: '#15803d' }}>
                                <IconCheck size={18} /> {message}
                            </div>
                        )}
                        {error && (
                            <div className="disclaimer-banner" style={{ marginBottom: 20, background: '#ffe4e6', borderColor: '#be123c', color: '#be123c' }}>
                                <IconAlert size={18} /> {error}
                            </div>
                        )}
                        <form onSubmit={handleSaveProfile}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
                                <div className="user-avatar" style={{ width: 56, height: 56, fontSize: '1.2rem', background: 'var(--accent-teal)' }}>
                                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'DR'}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{user?.name || 'Practitioner Profile'}</h2>
                                    <p style={{ color: 'var(--text-secondary)', margin: '2px 0 6px 0', fontSize: '0.9rem' }}>{user?.email}</p>
                                    <span className="badge badge-primary">{user?.role === 'doctor' ? 'Attending Physician' : user?.role}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                                <div className="input-group">
                                    <label>Physician Full Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Dr. John Doe, MD"
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Primary Hospital / Medical Center</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={hospitalName}
                                        onChange={(e) => setHospitalName(e.target.value)}
                                        placeholder="e.g. City General Hospital, Kochi"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Updating...' : 'Save Profile Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="settings-section">
                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-teal)', marginBottom: 16 }}>Clinical Language & Region</h3>
                <div className="card">
                    <div className="input-group" style={{ maxWidth: 400 }}>
                        <label>Primary Consultation Language</label>
                        <select className="input" defaultValue="en">
                            <option value="en">English (Standard Clinical)</option>
                            <option value="ml">Malayalam (മലയാളം)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-teal)', marginBottom: 16 }}>Security & Clinical Data Compliance</h3>
                <div className="card">
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: 16, lineHeight: 1.6 }}>
                        Patient records, audio transcripts, and clinical briefs are processed under strict medical data protection protocols. Access is strictly role-gated per authenticated practitioner session.
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span className="badge badge-success"><IconCheck size={14} /> End-to-End Encryption</span>
                        <span className="badge badge-success"><IconCheck size={14} /> Role-Based Access Control</span>
                        <span className="badge badge-primary"><IconCheck size={14} /> Digital Audit Trail</span>
                    </div>
                </div>
            </div>

            <div className="disclaimer-banner" style={{ marginTop: 32 }}>
                <span className="disclaimer-icon"><IconStethoscope size={18} /></span>
                <span>MedBrief AI Clinical Decision Support System — All AI-extracted medical data requires physician sign-off.</span>
            </div>
        </div>
    );
}
