import { waitForPendingWrites } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "../services/firebase/firestore.js";
import { useOnlineStatus } from "./useOnlineStatus.js";

export type SaveStatus = "salvo" | "salvando" | "offline" | "sincronizando" | "erro";

/**
 * Debounces writes of `value` via `onSave`, and reports a status the UI can
 * show directly (salvo/salvando/offline/sincronizando/erro). Firestore's
 * own offline persistence means `onSave` resolves immediately even without
 * a network connection (it's an optimistic local write) — so "offline" here
 * comes from the browser's connectivity, not from the save call failing,
 * and "sincronizando" is shown while Firestore still has queued writes to
 * flush to the server after connectivity returns.
 */
export function useDebouncedAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 800
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("salvo");
  const online = useOnlineStatus();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRun = useRef(true);
  const lastSavedValue = useRef(value);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      lastSavedValue.current = value;
      return;
    }
    if (value === lastSavedValue.current) return;

    clearTimeout(timeoutRef.current);
    setStatus(online ? "salvando" : "offline");

    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(value);
        lastSavedValue.current = value;
        setStatus(online ? "salvo" : "offline");
      } catch {
        setStatus("erro");
      }
    }, delayMs);

    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!online) {
      setStatus("offline");
      return;
    }
    setStatus((current) => (current === "offline" ? "sincronizando" : current));
    waitForPendingWrites(db).then(() => {
      setStatus((current) => (current === "sincronizando" ? "salvo" : current));
    });
  }, [online]);

  return status;
}
