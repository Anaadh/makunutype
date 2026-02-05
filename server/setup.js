import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setup() {
    // Initial connection without database specified
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    console.log('Connected to MySQL server.');

    const dbName = process.env.DB_NAME || 'makunutyper';
    console.log(`Ensuring database "${dbName}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await connection.query(`USE ${dbName}`);

    console.log('Initializing tables...');
    const sql = await fs.readFile(path.join(__dirname, 'db.sql'), 'utf8');

    // Split SQL but handle potential empty lines or comments
    const statements = sql
        .replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/i, '') // Remove hardcoded DB creation from SQL file
        .replace(/USE [^;]+;/i, '') // Remove hardcoded USE from SQL file
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await connection.query(statement);
    }

    console.log('Database setup completed successfully.');
    await connection.end();
}

setup().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
