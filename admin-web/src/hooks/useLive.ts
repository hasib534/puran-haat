import { useEffect, useRef, useState } from 'react';

import type { Doc } from '../lib/models';

type SubscribeCollection = (
  callback: (docs: Doc[]) => void,
  onError?: (error: Error) => void,
) => () => void;

type SubscribeDocument = (
  id: string,
  callback: (record: Doc | null) => void,
  onError?: (error: Error) => void,
) => () => void;

export interface LiveCollection<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

export interface LiveDocument<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribes to a Firestore collection and maps each document to a typed model.
 *
 * `key` re-subscribes (and resets to loading) when it changes — used for
 * per-document screens so navigating between two users never shows the
 * previous user's data.
 */
export function useLiveCollection<T>(
  subscribe: SubscribeCollection,
  map: (document: Doc) => T,
  key = 'collection',
): LiveCollection<T> {
  const subscribeRef = useRef(subscribe);
  const mapRef = useRef(map);
  useEffect(() => {
    subscribeRef.current = subscribe;
    mapRef.current = map;
  });

  const [state, setState] = useState<LiveCollection<T> & { key: string }>({
    data: [],
    loading: true,
    error: null,
    key,
  });

  useEffect(() => {
    const unsubscribe = subscribeRef.current(
      (docs) => setState({ data: docs.map(mapRef.current), loading: false, error: null, key }),
      (error) => setState({ data: [], loading: false, error: error.message, key }),
    );
    return unsubscribe;
  }, [key]);

  if (state.key !== key) return { data: [], loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}

export function useLiveDocument<T>(
  subscribe: SubscribeDocument,
  id: string,
  map: (document: Doc) => T,
): LiveDocument<T> {
  const subscribeRef = useRef(subscribe);
  const mapRef = useRef(map);
  useEffect(() => {
    subscribeRef.current = subscribe;
    mapRef.current = map;
  });

  const [state, setState] = useState<LiveDocument<T> & { key: string | null }>({
    data: null,
    loading: true,
    error: null,
    key: null,
  });

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeRef.current(
      id,
      (record) =>
        setState({
          data: record ? mapRef.current(record) : null,
          loading: false,
          error: null,
          key: id,
        }),
      (error) => setState({ data: null, loading: false, error: error.message, key: id }),
    );
    return unsubscribe;
  }, [id]);

  if (state.key !== id) return { data: null, loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}