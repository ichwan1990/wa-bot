const mysql = require('mysql2');

const db = mysql.createConnection({
    host: '192.168.88.11',
    user: 'simrs',
    password: 'Muslimat481986',
    database: 'db_simrs'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to database');
});

module.exports = { db };
