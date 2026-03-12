import fs from 'fs';
let txt = fs.readFileSync('src/backend/handlers/remoteIngestionHandler.js', 'utf8');
txt = txt.replace(/\/\/ Optional: we can push this to an explicit "rescues" queue, but simply ignoring the delete[\s\S]*?\/\/[^\n]*\n\s*continue/, "const [t, i] = k.split('#');\n        const row = getBeforeRows(t)[i];\n        if (row) rescues.push({ table: t, id: i, row });\n        continue");
fs.writeFileSync('src/backend/handlers/remoteIngestionHandler.js', txt);
