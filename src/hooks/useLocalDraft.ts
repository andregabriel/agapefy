import { useEffect } from 'react';

type Serializer<T> = (value: T) => any;
type Deserializer<T> = (raw: any) => T;

export function useLocalDraft<T>({
  key,
  value,
  onRestore,
  serialize,
  deserialize,
}: {
  key: string;
  value: T;
  onRestore: (restored: Partial<T>) => void;
  serialize?: Serializer<T>;
  deserialize?: Deserializer<Partial<T>>;
}) {
  // restore on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const restored = deserialize ? deserialize(parsed) : (parsed as Partial<T>);
      if (restored && typeof restored === 'object') onRestore(restored);
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // persist on change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const payload = serialize ? serialize(value) : value;
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }, [key, value, serialize]);
}


