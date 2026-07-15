import { useEffect, useState } from "react";
import { subscribeToVersion } from "../repositories/versionsRepository.js";
import type { VersionDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useVersion(
  songId: string | undefined,
  versionId: string | undefined
): { version: WithId<VersionDoc> | null; loading: boolean } {
  const { user } = useAuth();
  const [version, setVersion] = useState<WithId<VersionDoc> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !songId || !versionId) {
      setVersion(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToVersion(user.uid, songId, versionId, (next) => {
      setVersion(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, songId, versionId]);

  return { version, loading };
}
