require('dotenv').config();
const mysql = require('mysql2');

// Connection pool for SID database (rsump_sid)
const db = mysql.createPool({
    host: process.env.DB_HOST_SID,
    user: process.env.DB_USER_SID,
    password: process.env.DB_PASSWORD_SID,
    database: process.env.DB_NAME_SID,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { db };
