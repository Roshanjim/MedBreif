const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, queryOne, queryAll, runSql } = require('../config/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

        await getDb();
        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const password_hash = bcrypt.hashSync(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'doctor';
        const { lastId } = runSql('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, password_hash, userRole]);

        const token = jwt.sign({ id: lastId, email, name, role: userRole }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: 'Registration successful', token, user: { id: lastId, name, email, role: userRole } });
    } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Registration failed' }); }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        await getDb();
        const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Login failed' }); }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        await getDb();
        const user = queryOne('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

module.exports = router;
