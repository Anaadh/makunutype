import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// POST /api/leaderboard
app.post('/api/leaderboard', async (req, res) => {
    const { name, wpm, raw_wpm, accuracy, mode, config } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO leaderboard (name, wpm, raw_wpm, accuracy, mode, config) VALUES (?, ?, ?, ?, ?, ?)',
            [name, wpm, raw_wpm, accuracy, mode, config]
        );
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
