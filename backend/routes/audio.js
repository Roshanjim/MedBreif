const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, runSql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname) || '.webm'}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.mp3', '.wav', '.webm', '.ogg', '.m4a', '.mp4', '.flac'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

// POST /api/audio/upload
router.post('/upload', authenticateToken, upload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const visitId = req.body.visitId;
        if (visitId) {
            runSql('UPDATE visits SET audio_path = ?, status = ? WHERE id = ? AND doctor_id = ?',
                [req.file.filename, 'transcribing', parseInt(visitId), req.user.id]);
        }

        res.json({
            message: 'Audio uploaded successfully',
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size
        });
    } catch (err) {
        res.status(500).json({ error: 'Audio upload failed' });
    }
});

// GET /api/audio/:filename - Stream audio
router.get('/:filename', authenticateToken, (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }
    res.sendFile(filePath);
});

module.exports = router;
