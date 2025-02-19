const mysql = require('mysql2');

const db = mysql.createPool({
    host: '192.168.88.75',
    user: 'umum',
    password: 'PenunjangDB.RSUMP',
    database: 'rsi_pxridb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { db };
