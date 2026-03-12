import fs from 'fs';
let txt = fs.readFileSync('src/backend/handlers/remoteIngestionHandler.js', 'utf8');
txt = txt.replace('return { inserts, updates, deletes }', 'return { inserts, updates, deletes, rescues }');
fs.writeFileSync('src/backend/handlers/remoteIngestionHandler.js', txt);
