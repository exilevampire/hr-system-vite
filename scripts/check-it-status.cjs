const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "localhost", port: 3306, user: "root", password: "", database: "hr_integrity_db",
  });

  for (const field of ["fmis", "eMeeting", "software", "phonebook"]) {
    const [rows] = await conn.query(
      `SELECT \`${field}\` as val, COUNT(*) as cnt FROM employee GROUP BY \`${field}\` ORDER BY cnt DESC`
    );
    console.log(`\n${field}:`);
    rows.forEach((r) => console.log(`  "${r.val ?? "(null)"}"  →  ${r.cnt} records`));
  }

  await conn.end();
}

main().catch(console.error);
