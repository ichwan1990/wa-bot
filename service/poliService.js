const { db } = require('../config/db_simrs'); // Pastikan ini sesuai dengan nama file

async function getInfoPoli(tanggal) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT
                a.nama AS LAYANAN,
                dok.nama AS DOKTER,
                COUNT(*) AS TOTAL_PASIEN,
                SUM(CASE WHEN p.dilayani = '1' THEN 1 ELSE 0 END) AS SUDAH_DILAYANI,
                SUM(CASE WHEN p.dilayani = '0' THEN 1 ELSE 0 END) AS BELUM_DILAYANI
            FROM
                b_kunjungan k
                LEFT OUTER JOIN b_pelayanan p ON k.id = p.kunjungan_id
                LEFT OUTER JOIN b_ms_pasien mp ON mp.id = k.pasien_id
                LEFT OUTER JOIN b_ms_unit u ON u.id = k.unit_id
                LEFT OUTER JOIN b_ms_kso mk ON mk.id = k.kso_id
                LEFT OUTER JOIN b_ms_pegawai peg ON k.user_act = peg.id
                LEFT OUTER JOIN b_ms_pegawai dok ON p.dokter_id = dok.id
                LEFT OUTER JOIN b_ms_unit ak ON p.unit_id_asal = ak.id
                LEFT OUTER JOIN b_ms_unit a ON p.unit_id = a.id
            WHERE
                k.tgl = ?
                AND a.parent_kode IN ('01', '02', '03')
                AND a.id <> '219'
                AND a.parent_kode = '01'
            GROUP BY
                dok.nama,
                a.nama
            ORDER BY
                LAYANAN ASC
        `;

        db.query(query, [tanggal], (err, results) => {
            if (err) {
                console.error("Database Query Error:", err);
                return reject("Terjadi kesalahan dalam mengambil data layanan poli.");
            }

            if (results.length === 0) {
                return resolve(`Tidak ada data layanan poli tersedia untuk tanggal ${tanggal}.`);
            }

            let responseText = `*Info Layanan Poli (${tanggal}):*\n\n`;
            results.forEach((row) => {
                responseText += `🏥 *${row.LAYANAN}*\n`;
                responseText += `👨‍⚕️ Dokter: ${row.DOKTER}\n`;
                responseText += `✅ Sudah Dilayani: ${row.SUDAH_DILAYANI}\n`;
                responseText += `❌ Belum Dilayani: ${row.BELUM_DILAYANI}\n`;
                responseText += `📌 Total Pasien: ${row.TOTAL_PASIEN}\n\n`;
            });

            resolve(responseText);
        });
    });
}

module.exports = { getInfoPoli };
