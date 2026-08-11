import { useState, useRef } from 'react';
import { api } from '../api/client';

export default function UploadReport({ visitId, patientId, onUploadComplete }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;

        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (!allowed.includes(file.type)) {
            setError('Only PDF and image files (PNG, JPG, WEBP) are supported.');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            setError('File size must be under 20 MB.');
            return;
        }

        setUploading(true);
        setError('');
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('report', file);
            let data;
            if (patientId) {
                data = await api.uploadPatientReport(patientId, formData);
            } else {
                data = await api.uploadReport(visitId, formData);
            }
            setResult(data.report);
            if (onUploadComplete) onUploadComplete(data.report);
        } catch (err) {
            setError(err.message || 'Upload failed');
        }
        setUploading(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragActive(true);
    };

    return (
        <div className="upload-report-container">
            <h3 style={{ marginBottom: 12 }}>📎 Upload Medical Report</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
                Upload blood tests, radiology, lab results, or scan reports (PDF/Images)
            </p>

            <div
                className={`upload-area ${dragActive ? 'drag-active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragActive(false)}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="upload-icon">{uploading ? '⏳' : '📄'}</div>
                <p style={{ fontWeight: 500 }}>
                    {uploading ? 'Parsing report...' : 'Drag & drop or click to upload'}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    PDF, PNG, JPG, WEBP — max 20 MB
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files[0])}
                />
            </div>

            {error && (
                <div className="disclaimer-banner" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginTop: 12 }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {result && (
                <div className="card fade-in" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.2rem' }}>✅</span>
                        <strong>Report Parsed Successfully</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <span className="badge badge-primary">📋 {result.reportType}</span>
                        <span className="badge badge-success">🔍 {result.testResults?.length || 0} tests found</span>
                        <span className="badge" style={{ background: 'var(--bg-secondary)' }}>📝 {result.rawTextLength} chars extracted</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        File: {result.filename}
                    </p>
                </div>
            )}
        </div>
    );
}
