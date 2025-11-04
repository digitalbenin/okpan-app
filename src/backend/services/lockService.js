// Simple FIFO per-project lock to serialize DB writes
const projectQueues = new Map(); // projectId -> [runner]

export async function withProjectLock(projectId, fn) {
  if (!projectId) return fn();
  return new Promise((resolve, reject) => {
    let q = projectQueues.get(projectId);
    if (!q) {
      q = [];
      projectQueues.set(projectId, q);
    }
    const runner = async () => {
      try {
        const res = await fn();
        resolve(res);
      } catch (e) {
        reject(e);
      } finally {
        // Advance queue
        q.shift();
        const next = q[0];
        if (next) next();
        else if (q.length === 0) projectQueues.delete(projectId);
      }
    };
    q.push(runner);
    if (q.length === 1) {
      runner();
    }
  });
}