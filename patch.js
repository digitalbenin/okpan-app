import fs from 'fs';
let txt = fs.readFileSync('src/backend/handlers/remoteIngestionHandler.js', 'utf8');
txt = txt.replace('// preserves the row in SQLite so the user can manually recover it or sync it back next save.\r\n        continue', 'const [t, i] = k.split(\\'#\\');\n        const row = getBeforeRows(t)[i];\n        if (row) rescues.push({ table: t, id: i, row });\n        continue');
txt = txt.replace('// preserves the row in SQLite so the user can manually recover it or sync it back next save.\n        continue', 'const [t, i] = k.split(\\'#\\');\n        const row = getBeforeRows(t)[i];\n        if (row) rescues.push({ table: t, id: i, row });\n        continue');
txt = txt.replace('return { inserts, updates, deletes }', 'return { inserts, updates, deletes, rescues }');
fs.writeFileSync('src/backend/handlers/remoteIngestionHandler.js', txt);
