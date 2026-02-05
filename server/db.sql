CREATE DATABASE IF NOT EXISTS makunutyper;

USE makunutyper;

CREATE TABLE IF NOT EXISTS leaderboard (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    wpm INT NOT NULL,
    raw_wpm INT NOT NULL,
    accuracy INT NOT NULL,
    mode ENUM('time', 'words') NOT NULL,
    config INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
