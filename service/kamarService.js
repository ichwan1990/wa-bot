const { db } = require('../config/db_sirs'); // Pastikan ini sesuai dengan nama file

async function getInfoKamar() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                m.nama AS NAMA_RUANG,
                k.kode_bpjs AS KELAS,
                SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS TERPAKAI,
                COUNT(*) - SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS KOSONG,
                COUNT(*) AS TOTAL
            FROM ri_kamar k
            LEFT JOIN ri_ms_rawatinap m ON k.ruang = m.kode
            WHERE k.status_aktif = '1' 
              AND k.kode_tt <> 0
            GROUP BY m.nama, k.kode_bpjs
            ORDER BY m.nama ASC, k.kode_bpjs ASC
        `;

        db.query(query, (err, results) => {
            if (err) {
                console.error("Database Query Error:", err);
                return reject("Terjadi kesalahan dalam mengambil data kamar.");
            }

            if (results.length === 0) {
                return resolve("Tidak ada data kamar tersedia.");
            }

            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const formattedDate = `${dd}-${mm}-${yyyy}`; // format Indonesia tgl-bln-tahun
            const formattedTime = now.toLocaleTimeString('id-ID');
            let responseText = `🏥 *Informasi Kamar:*\n\n*Tanggal:* ${formattedDate} ${formattedTime}\n\n`;
            let currentRuang = '';

            results.forEach((row) => {
                if (row.NAMA_RUANG !== currentRuang) {
                    currentRuang = row.NAMA_RUANG;
                    responseText += `🛏 *${currentRuang}*\n`;
                }
                responseText += `- ${row.KELAS} : _Kosong :_ ${row.KOSONG} | _Terpakai :_ ${row.TERPAKAI} | _Total :_ ${row.TOTAL}\n`;
            });

            resolve(responseText);
        });
    });
}

async function getInfoKamarRows() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                m.nama AS NAMA_RUANG,
                k.kode_bpjs AS KELAS,
                SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS TERPAKAI,
                COUNT(*) - SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS KOSONG,
                COUNT(*) AS TOTAL
            FROM ri_kamar k
            LEFT JOIN ri_ms_rawatinap m ON k.ruang = m.kode
            WHERE k.status_aktif = '1' 
              AND k.kode_tt <> 0
            GROUP BY m.nama, k.kode_bpjs
            ORDER BY m.nama ASC, k.kode_bpjs ASC
        `;

        db.query(query, (err, results) => {
            if (err) {
                console.error("Database Query Error:", err);
                return reject("Terjadi kesalahan dalam mengambil data kamar.");
            }
            resolve(results || []);
        });
    });
}

module.exports = { getInfoKamar, getInfoKamarRows };