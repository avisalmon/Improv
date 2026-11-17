// Project storage in IndexedDB (stays in this browser on this computer).

const DB = 'improv', STORE = 'projects';
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const listProjects = () => tx('readonly', (s) => s.getAll());
export const getProject = (id) => tx('readonly', (s) => s.get(id));
export const putProject = (p) => tx('readwrite', (s) => s.put(p));
export const deleteProject = (id) => tx('readwrite', (s) => s.delete(id));
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
