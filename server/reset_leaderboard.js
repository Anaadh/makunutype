import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetLeaderboard() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'makunutyper'
        });

        console.log('Connected to database.');

        console.log('Resetting leaderboard...');
        await connection.query('TRUNCATE TABLE leaderboard');
        
        console.log('Leaderboard has been successfully reset.');

    } catch (error) {
        console.error('Error resetting leaderboard:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connection closed.');
        }
    }
}

resetLeaderboard();
