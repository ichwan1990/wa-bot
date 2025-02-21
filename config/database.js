require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST_SIMPLUS,
    user: process.env.DB_USER_SIMPLUS,
    password: process.env.DB_PASSWORD_SIMPLUS,
    database: process.env.DB_NAME_SIMPLUS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { db };
