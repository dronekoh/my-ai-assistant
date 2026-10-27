// ブラウザ側の保存場所（2）。鍵は CryptoKey のまま IndexedDB に入れる（extractable=false なので、取り出して読むことはできない）。
export function idbStore(dbName = 'my-ai-assistant-web', storeName = 'kv') {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(storeName);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(storeName, mode); const req = fn(t.objectStore(storeName));
      t.oncomplete = () => { db.close(); res(req.result); }; t.onerror = () => { db.close(); rej(t.error); }; t.onabort = () => { db.close(); rej(t.error); };
    });
  };
  return { get: (k) => tx('readonly', (s) => s.get(k)), put: (k, v) => tx('readwrite', (s) => s.put(v, k)), del: (k) => tx('readwrite', (s) => s.delete(k)) };
}
// 試験用（node）: IndexedDB と同じく structuredClone を通して出し入れする＝CryptoKey の取り出せなさも IndexedDB と同じ性質で確かめられる
export function memoryStore() {
  const m = new Map();
  return { async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; }, async put(k, v) { m.set(k, structuredClone(v)); }, async del(k) { m.delete(k); } };
}
