require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST_SIMRS,
    user: process.env.DB_USER_SIMRS,
    password: process.env.DB_PASSWORD_SIMRS,
    database: process.env.DB_NAME_SIMRS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { db };
