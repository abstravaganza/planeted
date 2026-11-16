/** Browser-local audio retention. Never store audio in localStorage or on the app server. */
export type Recording = {
  id: string;
  blob: Blob;
  createdAt: number;
  expiresAt: number;
  audioId?: string;
};
const session = new Map<string, Recording>();
function sweepMemory() {
  for (const [id, record] of session)
    if (record.expiresAt > 0 && record.expiresAt <= Date.now())
      session.delete(id);
}
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("writing-quest-audio", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("recordings", { keyPath: "id" });
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("recordings", "readwrite");
      const cursor = tx.objectStore("recordings").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.value.expiresAt > 0 && row.value.expiresAt <= Date.now())
            row.delete();
          row.continue();
        }
      };
      tx.oncomplete = () => resolve(db);
      tx.onerror = () =>
        reject(new Error("Audio retention cleanup unavailable"));
    };
    request.onerror = () => reject(new Error("Audio storage unavailable"));
  });
}
export async function keepRecording(
  id: string,
  blob: Blob,
  hours: number,
  audioId = id,
) {
  sweepMemory();
  const record = {
    id,
    blob,
    audioId,
    createdAt: Date.now(),
    expiresAt: hours > 0 ? Date.now() + Math.min(hours, 168) * 3600000 : 0,
  };
  session.set(id, record);
  session.set(audioId, { ...record, id: audioId });
  if (hours <= 0) return;
  const db = await openStore();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(record);
    if (audioId !== id)
      tx.objectStore("recordings").put({ ...record, id: audioId });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Recording could not be retained"));
  });
  db.close();
}
export async function getRecording(id: string) {
  sweepMemory();
  const memory = session.get(id);
  if (memory && (!memory.expiresAt || memory.expiresAt > Date.now()))
    return memory;
  if (typeof indexedDB === "undefined") return null;
  const db = await openStore();
  const record = await new Promise<Recording | undefined>((resolve, reject) => {
    const request = db
      .transaction("recordings")
      .objectStore("recordings")
      .get(id);
    request.onsuccess = () => resolve(request.result as Recording | undefined);
    request.onerror = () => reject(new Error("Recording unavailable"));
  });
  db.close();
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    await forgetRecording(id);
    return null;
  }
  return record;
}
export async function forgetRecording(id: string) {
  session.delete(id);
  if (typeof indexedDB === "undefined") return;
  const db = await openStore();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Could not remove audio"));
  });
  db.close();
}
export function audioError(status: number) {
  return status === 503
    ? "Transcription is not configured. Set AI_ENABLED=true, TRANSCRIPTION_ENABLED=true and OPENAI_API_KEY on the server, then restart. You can type below."
    : status === 429
      ? "Transcription limit reached. Your recording is retained for retry."
      : status === 413
        ? "Recording is too large. Rerecord a shorter sentence."
        : "Transcription failed. Your audio remains available; retry or type below.";
}
