import fs from 'fs';
let txt = fs.readFileSync('src/backend/services/changeLogTailerService.js', 'utf8');

const replacement = \doc.transact(() => {
      try {
        for (const op of ops) {
          if (op.tableName === 'project' && op.kind === 'set') {
             const tables = doc.getMap('tables');
             for (const t of FK_ORDER) {
               if (!tables.get(t)) tables.set(t, new Y.Map());
             }
          }
        }

        for (const op of ops) {\;

txt = txt.replace('doc.transact(() => {\\n      try {\\n        for (const op of ops) {', replacement);
txt = txt.replace(/doc\.transact\(\(\) => \{\s*try \{\s*for \(const op of ops\) \{/m, replacement);
fs.writeFileSync('src/backend/services/changeLogTailerService.js', txt);
