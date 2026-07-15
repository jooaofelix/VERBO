import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../services/firestoreAdmin.js";

const WINDOW_MS = 60 * 60 * 1000;

/**
 * Simple per-user, per-action rate limit backed by a Firestore counter doc
 * (users/{uid}/settings/rateLimit_{action}). Good enough to blunt runaway
 * loops or abusive scripting against the (paid, per-call) AI provider
 * without standing up separate rate-limiting infrastructure.
 */
export async function assertWithinRateLimit(
  uid: string,
  action: string,
  maxCallsPerHour: number
): Promise<void> {
  const ref = db.doc(`users/${uid}/settings/rateLimit_${action}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data();
    const windowStart = data?.windowStart?.toMillis?.() ?? 0;
    const count = data?.count ?? 0;

    if (now - windowStart > WINDOW_MS) {
      tx.set(ref, { windowStart: FieldValue.serverTimestamp(), count: 1 });
      return;
    }

    if (count >= maxCallsPerHour) {
      throw new HttpsError(
        "resource-exhausted",
        `Limite de ${maxCallsPerHour} chamadas por hora para esta função foi atingido. Tente novamente mais tarde.`
      );
    }

    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
