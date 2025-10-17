import { useCallback, useState } from 'react';
import { DebugInfo, DebugApi, DebugType } from '@/types/ai';

export function useDebugLogs() {
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);

  const addDebugLog = useCallback((type: DebugType, api: DebugApi, data: any) => {
    const newLog: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      api,
      data,
    };
    setDebugLogs((prev) => [newLog, ...prev].slice(0, 10));
  }, []);

  const clearLogs = useCallback(() => setDebugLogs([]), []);

  return { showDebug, setShowDebug, debugLogs, addDebugLog, clearLogs };
}


