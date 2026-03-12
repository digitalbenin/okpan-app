import fs from 'fs';
let txt = fs.readFileSync('src/backend/handlers/remoteIngestionHandler.js', 'utf8');
const rescueBlock = \
    if (rescues && rescues.length > 0) {
      console.warn('[RemoteIngestion] Recovering orphaned rows due to Yjs map replacement...', rescues.length);
      try {
        const canonical = getProjectDoc(projectId);
        canonical.transact(() => {
          for (const r of rescues) {
             const tablesMap = canonical.getMap('tables');
             if (!tablesMap.get(r.table)) tablesMap.set(r.table, new Y.Map());
             const tableMap = tablesMap.get(r.table);
             if (!tableMap.has(r.id)) {
                const rowMap = new Y.Map();
                for (const [k, v] of Object.entries(r.row || {})) {
                  rowMap.set(k, v);
                }
                tableMap.set(r.id, rowMap);
                console.warn('[RemoteIngestion] Rescued orphaned row into Yjs:', r.table, r.id);
             }
          }
        }, 'ingestion');
      } catch (e) {
        console.error('[RemoteIngestion] Rescue map replacement fail', e);
      }
    }

\;

const target = 'deferredDeletes }';
let index = txt.lastIndexOf(target);
if (index !== -1) {
  // get start of line
  let lineStart = txt.lastIndexOf('\\n', index);
  txt = txt.substring(0, lineStart) + '\\n' + rescueBlock + txt.substring(lineStart);
  fs.writeFileSync('src/backend/handlers/remoteIngestionHandler.js', txt);
} else {
  console.log("Not found!");
}
