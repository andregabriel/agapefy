import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { DebugInfo } from '@/types/ai';

export function DebugPanel({
  showDebug,
  setShowDebug,
  debugLogs,
  onClear,
}: {
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  debugLogs: DebugInfo[];
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug API - Input/Output
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)}>
            {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>
          Visualize as requisições e respostas das APIs em tempo real
        </CardDescription>
      </CardHeader>
      {showDebug && (
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {debugLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum log de debug ainda. Execute uma ação para ver os dados.
              </p>
            ) : (
              debugLogs.map((log, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      log.type === 'request' ? 'bg-blue-100 text-blue-800' :
                      log.type === 'response' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                      {log.api.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.timestamp}
                    </span>
                  </div>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
          {debugLogs.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
              Limpar Logs
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}


