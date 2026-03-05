import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('medbrief_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            api.getProfile()
                .then(data => {
                    setUser(data.user);
                    setLoading(false);
                })
                .catch(() => {
                    localStorage.removeItem('medbrief_token');
                    setToken(null);
                    setUser(null);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = async (email, password) => {
        const data = await api.login({ email, password });
        localStorage.setItem('medbrief_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const register = async (name, email, password, role) => {
        const data = await api.register({ name, email, password, role });
        localStorage.setItem('medbrief_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('medbrief_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
