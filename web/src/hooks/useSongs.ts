import { useEffect, useState } from "react";
import { subscribeToSongs } from "../repositories/songsRepository.js";
import type { SongDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSongs(): { songs: WithId<SongDoc>[]; loading: boolean } {
  const { user } = useAuth();
  const [songs, setSongs] = useState<WithId<SongDoc>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSongs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToSongs(user.uid, (next) => {
      setSongs(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return { songs, loading };
}
