import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors({
    origin: true,
    credentials: true // Required for sessions with CORS
}));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'makunu-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 3600000 // 1 hour
    }
}));


const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'makunutyper',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// GET /api/leaderboard?mode=time&config=30
app.get('/api/leaderboard', async (req, res) => {
    const { mode, config } = req.query;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM leaderboard WHERE mode = ? AND config = ? ORDER BY wpm DESC LIMIT 10',
            [mode, config]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/session-score
app.post('/api/session-score', (req, res) => {
    const { wpm, raw_wpm, accuracy, mode, config } = req.body;
    req.session.lastScore = { wpm, raw_wpm, accuracy, mode, config };
    res.json({ success: true });
});

// POST /api/leaderboard
app.post('/api/leaderboard', async (req, res) => {
    const { name, recaptchaToken } = req.body;
    const lastScore = req.session.lastScore;

    if (!lastScore) {
        return res.status(400).json({ error: 'No test attempt found in session' });
    }

    const { wpm, raw_wpm, accuracy, mode, config } = lastScore;

    // Verify Recaptcha
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    // Only verify if secret key is present (allows development without captcha if not configured)
    if (secretKey) {
        if (!recaptchaToken) {
            return res.status(400).json({ error: 'Recaptcha token is missing' });
        }

        try {
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
            const response = await axios.post(verificationUrl);

            if (!response.data.success) {
                return res.status(400).json({ error: 'Recaptcha verification failed' });
            }
        } catch (error) {
            console.error('Recaptcha verification error:', error);
            return res.status(500).json({ error: 'Recaptcha verification error' });
        }
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO leaderboard (name, wpm, raw_wpm, accuracy, mode, config) VALUES (?, ?, ?, ?, ?, ?)',
            [name, wpm, raw_wpm, accuracy, mode, config]
        );

        // Clear session score after saving
        delete req.session.lastScore;

        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error('Error saving score:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve the frontend's index.html
app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
