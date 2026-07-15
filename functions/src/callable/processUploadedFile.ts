import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireUid } from "../security/auth.js";
import { assertSongExists } from "../security/ownership.js";
import { getBucket, db } from "../services/firestoreAdmin.js";

const InputSchema = z.object({
  storagePath: z.string().min(1),
  songId: z.string().min(1).optional(),
  kind: z.enum(["audio", "recording", "pdf", "docx", "cover", "attachment"]),
});

const MAX_METADATA_BYTES = 50 * 1024 * 1024; // 50MB, mirrors storage.rules

/**
 * Registers metadata for a file the client already uploaded directly to
 * Firebase Storage (small files go straight from the browser using the
 * Storage SDK + storage.rules — this function never receives file bytes).
 * Only path/name/type/size/owner/date get written to Firestore; the file
 * itself always stays in Storage.
 */
export const processUploadedFile = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireUid(request);
  const input = InputSchema.parse(request.data);

  const expectedPrefix = `users/${uid}/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    throw new HttpsError(
      "permission-denied",
      "O caminho do arquivo precisa estar dentro do diretório do usuário autenticado."
    );
  }

  if (input.songId) {
    await assertSongExists(uid, input.songId);
  }

  const [metadata] = await getBucket().file(input.storagePath).getMetadata();
  const size = Number(metadata.size ?? 0);

  if (size > MAX_METADATA_BYTES) {
    throw new HttpsError("invalid-argument", "Arquivo excede o tamanho máximo permitido.");
  }

  const collectionPath = input.songId
    ? `users/${uid}/songs/${input.songId}/attachments`
    : `users/${uid}/files`;

  const fileRef = db.collection(collectionPath).doc();
  await fileRef.set({
    path: input.storagePath,
    name: input.storagePath.split("/").pop(),
    kind: input.kind,
    contentType: metadata.contentType ?? null,
    size,
    userId: uid,
    songId: input.songId ?? null,
    status: "completed",
    uploadedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { fileId: fileRef.id };
});
