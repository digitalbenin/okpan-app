import fs from 'fs';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const fileBuffer = fs.readFileSync('../db/local.db');
const db = new SQL.Database(fileBuffer);

const res = db.exec(`
  SELECT o.institution_id, COUNT(DISTINCT o.id) AS count
  FROM objects o
  GROUP BY o.institution_id
`);
console.log(JSON.stringify(res, null, 2));
