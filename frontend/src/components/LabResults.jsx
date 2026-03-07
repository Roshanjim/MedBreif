import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function LabResults({ visitId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedReport, setExpandedReport] = useState(null);

    useEffect(() => {
        if (!visitId) return;
        api.getVisitReports(visitId)
            .then(data => {
                setReports(data.reports || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [visitId]);

    const handleDelete = async (reportId) => {
        if (!confirm('Delete this report?')) return;
        try {
            await api.deleteReport(reportId);
            setReports(reports.filter(r => r.id !== reportId));
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const getFlagStyle = (flag) => {
        switch (flag) {
            case 'high': return { color: '#ef4444', fontWeight: 600 };
            case 'low': return { color: '#f59e0b', fontWeight: 600 };
            case 'normal': return { color: '#22c55e', fontWeight: 600 };
            default: return { color: 'var(--text-secondary)' };
        }
    };

    const getFlagBadge = (flag) => {
        switch (flag) {
            case 'high': return <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.7rem' }}>↑ HIGH</span>;
            case 'low': return <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.7rem' }}>↓ LOW</span>;
            case 'normal': return <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.7rem' }}>✓ Normal</span>;
            default: return <span className="badge" style={{ background: 'var(--bg-secondary)', fontSize: '0.7rem' }}>—</span>;
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner"></div><p>Loading lab results...</p></div>;
    }

    if (reports.length === 0) {
        return (
            <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">🔬</div>
                <h3>No Lab Reports</h3>
                <p style={{ color: 'var(--text-muted)' }}>Upload medical reports from the consultation page to see parsed results here.</p>
            </div>
        );
    }

    return (
        <div className="lab-results-container fade-in">
            {reports.map(report => {
                const parsed = report.parsedData;
                const testResults = parsed?.testResults || [];
                const isExpanded = expandedReport === report.id;
                const abnormalCount = testResults.filter(t => t.flag === 'high' || t.flag === 'low').length;

                return (
                    <div key={report.id} className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div>
                                <h4 style={{ marginBottom: 4 }}>📋 {parsed?.reportType || report.reportType}</h4>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>📄 {report.filename}</span>
                                    <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>🔍 {testResults.length} tests</span>
                                    {abnormalCount > 0 && (
                                        <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.75rem' }}>⚠️ {abnormalCount} abnormal</span>
                                    )}
                                    <span className="badge" style={{ background: 'var(--bg-secondary)', fontSize: '0.75rem' }}>{new Date(report.createdAt).toLocaleDateString('en-IN')}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                                >
                                    {isExpanded ? '▲ Collapse' : '▼ Expand'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.8rem', padding: '4px 10px', color: 'var(--accent-danger)' }}
                                    onClick={() => handleDelete(report.id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>

                        {isExpanded && testResults.length > 0 && (
                            <table className="medicine-table" style={{ marginTop: 8 }}>
                                <thead>
                                    <tr>
                                        <th>Test Name</th>
                                        <th>Value</th>
                                        <th>Unit</th>
                                        <th>Reference</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testResults.map((t, i) => (
                                        <tr key={i} style={t.flag === 'high' || t.flag === 'low' ? { background: 'rgba(239,68,68,0.03)' } : {}}>
                                            <td style={{ fontWeight: 500 }}>{t.testName}</td>
                                            <td style={getFlagStyle(t.flag)}>{t.value}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{t.unit}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.referenceRange}</td>
                                            <td>{getFlagBadge(t.flag)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {isExpanded && testResults.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 8 }}>
                                No structured test results could be extracted. The raw text was captured for reference.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
