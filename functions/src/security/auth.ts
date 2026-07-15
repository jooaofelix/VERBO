import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/**
 * Returns the caller's UID from the verified auth token — never from a
 * client-supplied field. Every callable in this project must derive its
 * Firestore/Storage path from this value, not from `request.data.userId`.
 */
export function requireUid(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado para usar esta função.");
  }
  return request.auth.uid;
}
