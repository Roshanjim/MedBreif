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

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Loading MedBrief AI...</p>
            </div>
        );
    }
    return user ? children : <Navigate to="/login" />;
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
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <Dashboard />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/new" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <NewConsultation />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/transcript" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <TranscriptReview />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/summary" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <AISummary />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/visit/:id/review" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <EditReview />
                        </main>
                    </div>
                </ProtectedRoute>
            } />
            <Route path="/settings" element={
                <ProtectedRoute>
                    <div className="app-layout">
                        <Navbar />
                        <main className="main-content fade-in">
                            <Settings />
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
