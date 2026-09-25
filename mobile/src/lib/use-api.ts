import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './api';

/**
 * Fetch JSON from the API whenever the screen gains focus (so lists stay fresh
 * after navigating back). Pass `null` as path to skip.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(path);
  useEffect(() => {
    latest.current = path;
  }, [path]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!path) return;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await api<T>('GET', path);
        if (latest.current === path) {
          setData(result);
          setError(null);
        }
      } catch (e: any) {
        if (latest.current === path) setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      load('silent');
    }, [load]),
  );

  return { data, setData, error, loading: loading && !data, refreshing, reload: () => load('refresh') };
}
