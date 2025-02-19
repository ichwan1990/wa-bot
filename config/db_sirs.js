require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST_SIRS,
    user: process.env.DB_USER_SIRS,
    password: process.env.DB_PASSWORD_SIRS,
    database: process.env.DB_NAME_SIRS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { db };
