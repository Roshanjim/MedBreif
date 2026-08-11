import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

    return (
        <>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                ☰
            </button>
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">M</div>
                    <div>
                        <h1>MedBrief AI</h1>
                        <span>Medical Summarizer</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {user?.role === 'patient' ? (
                        <NavLink to={`/patients/${user.id}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}>
                            <span className="nav-icon">📂</span> My Records
                        </NavLink>
                    ) : (
                        <>
                            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}>
                                <span className="nav-icon">📊</span> Dashboard
                            </NavLink>
                            <NavLink to="/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}>
                                <span className="nav-icon">🎙️</span> New Consultation
                            </NavLink>
                            <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}>
                                <span className="nav-icon">👥</span> Patients
                            </NavLink>
                            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}>
                                <span className="nav-icon">⚙️</span> Settings
                            </NavLink>
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{initials}</div>
                        <div className="user-details">
                            <div className="user-name">{user?.name || 'Doctor'}</div>
                            <div className="user-role">{user?.role || 'doctor'}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
                            ↪
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
