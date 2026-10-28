const DB = 'fephotos-admin-v1';
const STORE = 'drafts';
let connection;
async function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('O navegador não permitiu salvar o rascunho.'));
  });
  return connection;
}
async function transaction(mode, callback) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = callback(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(new Error('Não foi possível salvar o rascunho neste navegador.'));
    tx.onabort = () => reject(new Error('Não foi possível salvar o rascunho neste navegador.'));
  });
}
export const readDraft = () => transaction('readonly', store => store.get('current'));
export const saveDraft = value => transaction('readwrite', store => store.put(value, 'current'));
export const clearDraft = () => transaction('readwrite', store => store.delete('current'));
