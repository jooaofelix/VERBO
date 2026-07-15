import type { AttachmentKind } from "../services/firebase/storage.js";
import { callFunction } from "../services/firebase/functions.js";

export async function processUploadedFile(input: {
  storagePath: string;
  songId?: string;
  kind: AttachmentKind;
}): Promise<{ fileId: string }> {
  return callFunction("processUploadedFile", input);
}
