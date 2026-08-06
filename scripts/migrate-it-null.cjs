const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "localhost", port: 3306, user: "root", password: "", database: "hr_integrity_db",
  });

  for (const field of ["fmis", "eMeeting", "software", "phonebook"]) {
    const [result] = await conn.query(
      `UPDATE employee SET \`${field}\` = 'ไม่พบบัญชี' WHERE \`${field}\` IS NULL`
    );
    console.log(`${field}: updated ${result.affectedRows} rows`);
  }

  // Verify
  console.log("\nVerification:");
  for (const field of ["fmis", "eMeeting", "software", "phonebook"]) {
    const [rows] = await conn.query(
      `SELECT \`${field}\` as val, COUNT(*) as cnt FROM employee GROUP BY \`${field}\` ORDER BY cnt DESC`
    );
    console.log(`${field}: ${rows.map(r => `"${r.val}"=${r.cnt}`).join(", ")}`);
  }

  await conn.end();
}

main().catch(console.error);
