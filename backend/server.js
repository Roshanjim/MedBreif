require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const visitRoutes = require('./routes/visits');
const audioRoutes = require('./routes/audio');
const aiRoutes = require('./routes/ai');
const pdfRoutes = require('./routes/pdf');
const reportRoutes = require('./routes/reports');
const feedbackRoutes = require('./routes/feedback');
const patientRoutes = require('./routes/patients');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'MedBrief AI Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai-feedback', feedbackRoutes);
app.use('/api/patients', patientRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handler
app.use(errorHandler);

// Initialize DB then start server
const { getDb } = require('./config/db');
getDb().then(() => {
    app.listen(PORT, () => {
        console.log(`\n  MedBrief AI Backend running on http://localhost:${PORT}`);
        console.log(`  Health check: http://localhost:${PORT}/api/health`);
        console.log(`  API Base: http://localhost:${PORT}/api\n`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
