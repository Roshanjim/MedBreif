import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function PatientsList() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        api.getPatients()
            .then(data => { setPatients(data.patients); setLoading(false); })
            .catch(err => { console.error(err); setLoading(false); });
    }, []);

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.patient_uid.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading patients...</p></div>;
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Patients Directory</h1>
                    <p className="page-subtitle">Manage your registered patients</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>
                    + Register New Patient
                </button>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <input
                    type="text"
                    className="input"
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="visits-list">
                {filteredPatients.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <h3>No patients found</h3>
                        <p>{search ? 'Try adjusting your search' : 'Register your first patient to get started.'}</p>
                    </div>
                ) : (
                    filteredPatients.map(patient => (
                        <div key={patient.id} className="visit-card" onClick={() => navigate(`/patients/${patient.id}`)} style={{ cursor: 'pointer' }}>
                            <div className="visit-header">
                                <div className="visit-patient">
                                    <div className="patient-avatar">{patient.name[0]}</div>
                                    <div>
                                        <div className="patient-name">{patient.name}</div>
                                        <div className="patient-id" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {patient.patient_uid} • {patient.age ? `${patient.age} yrs` : 'Age unknown'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
