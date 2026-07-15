import { useEffect, useState } from "react";
import { subscribeToSong } from "../repositories/songsRepository.js";
import type { SongDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSong(songId: string | undefined): {
  song: WithId<SongDoc> | null;
  loading: boolean;
} {
  const { user } = useAuth();
  const [song, setSong] = useState<WithId<SongDoc> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !songId) {
      setSong(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToSong(user.uid, songId, (next) => {
      setSong(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, songId]);

  return { song, loading };
}
