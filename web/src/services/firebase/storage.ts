import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseApp } from "./app.js";

export const storage = getStorage(firebaseApp);

export type AttachmentKind = "audio" | "recording" | "pdf" | "docx" | "cover" | "attachment";

/**
 * Uploads a file under users/{uid}/... — the only path prefix storage.rules
 * allows the owner to write to. Returns the storage path (not the file
 * itself) so callers can hand it to the processUploadedFile callable, which
 * records metadata in Firestore without ever touching the file bytes.
 */
export async function uploadUserFile(
  uid: string,
  kind: AttachmentKind,
  file: File,
  songId?: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  const segment = songId ? `songs/${songId}/${kind}` : kind;
  const storagePath = `users/${uid}/${segment}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath, downloadUrl };
}
