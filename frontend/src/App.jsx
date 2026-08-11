import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewConsultation from './pages/NewConsultation';
import TranscriptReview from './pages/TranscriptReview';
import AISummary from './pages/AISummary';
import EditReview from './pages/EditReview';
import Settings from './pages/Settings';
import PatientsList from './pages/PatientsList';
import PatientRegistration from './pages/PatientRegistration';
import PatientDetails from './pages/PatientDetails';

function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Loading MedBrief AI...</p>
            </div>
        );
    }
    
    if (!user) return <Navigate to="/login" />;
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // If patient tries to access doctor routes, redirect to their profile
        if (user.role === 'patient') return <Navigate to={`/patients/${user.id}`} />;
        // Otherwise go to home
        return <Navigate to="/" />;
    }
    
    return children;
}

function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-overlay" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
                <p>Loading MedBrief AI...</p>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/" element={
                <ProtectedRoute>
                    {user?.role === 'patient' ? (
                        <Navigate to={`/patients/${user.id}`} />
                    ) : (
                        <div className="app-layout">
                            <Navbar />
                            <main className="main-content fade-in">
                                <Dashboard />
                            </main>
                        </div>
                    )}
                </ProtectedRoute>
            } />
            <Route path="/new" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <NewConsultation />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/transcript" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <TranscriptReview />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/summary" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <AISummary />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/review" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <EditReview />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <Settings />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/patients" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <PatientsList />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/patients/new" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <PatientRegistration />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/patients/:id" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <PatientDetails />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
