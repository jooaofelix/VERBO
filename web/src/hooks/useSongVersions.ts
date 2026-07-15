import { useEffect, useState } from "react";
import { subscribeToVersions } from "../repositories/versionsRepository.js";
import type { VersionDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSongVersions(songId: string | undefined): {
  versions: WithId<VersionDoc>[];
  loading: boolean;
} {
  const { user } = useAuth();
  const [versions, setVersions] = useState<WithId<VersionDoc>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !songId) {
      setVersions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToVersions(user.uid, songId, (next) => {
      setVersions(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, songId]);

  return { versions, loading };
}
