const { db } = require('../config/db_sirs'); // Pastikan ini sesuai dengan nama file

async function getInfoKamar() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                k.kode_tt AS ID_SIRS,
                k.kode_bpjs AS KODE_BPJS,
                m.nama AS NAMA,
                SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS TERPAKAI,
                COUNT(*) - SUM(CASE WHEN k.status_pakai IN ('3', '4') THEN 1 ELSE 0 END) AS KOSONG,
                COUNT(*) AS TOTAL
            FROM ri_kamar k
            LEFT JOIN ri_ms_rawatinap m ON k.ruang = m.kode
            WHERE k.status_aktif = '1' 
              AND k.kode_tt <> 0
            GROUP BY k.kode_tt, k.ruang, k.kode_bpjs, m.nama, k.is_cov
            ORDER BY k.kode_tt ASC
        `;

        db.query(query, (err, results) => {
            if (err) {
                console.error("Database Query Error:", err);
                return reject("Terjadi kesalahan dalam mengambil data kamar.");
            }

            if (results.length === 0) {
                return resolve("Tidak ada data kamar tersedia.");
            }

            let responseText = '*Info Kamar:*\n\n';
            results.forEach((row) => {
                responseText += `🏥 *${row.NAMA}*\n`;
                responseText += `- ID SIRS: ${row.ID_SIRS}\n`;
                responseText += `- Kode BPJS: ${row.KODE_BPJS}\n`;
                responseText += `- Terpakai: ${row.TERPAKAI}\n`;
                responseText += `- Kosong: ${row.KOSONG}\n`;
                responseText += `- Total: ${row.TOTAL}\n\n`;
            });

            resolve(responseText);
        });
    });
}

module.exports = { getInfoKamar };
