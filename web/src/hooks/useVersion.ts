import { useEffect, useState } from "react";
import { subscribeToVersion } from "../repositories/versionsRepository.js";
import type { VersionDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useVersion(
  songId: string | undefined,
  versionId: string | undefined
): { version: WithId<VersionDoc> | null; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const [version, setVersion] = useState<WithId<VersionDoc> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !songId || !versionId) {
      setVersion(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToVersion(
      user.uid,
      songId,
      versionId,
      (next) => {
        setVersion(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, songId, versionId]);

  return { version, loading, error };
}
