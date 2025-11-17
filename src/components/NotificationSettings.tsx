"use client";

import { Bell, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationSettings() {
  const { novidadesEnabled, updateNovidades } = useNotifications();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-800 hover:bg-gray-800/50">
        <div className="flex items-center space-x-3">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <div>
            <h4 className="text-white font-medium">Novidades</h4>
            <p className="text-sm text-gray-400">
              Quando algo novo surgir na Agapefy pra você ficar mais próximo de Deus
            </p>
          </div>
        </div>
        <Switch
          checked={novidadesEnabled}
          onCheckedChange={updateNovidades}
        />
      </div>
    </div>
  );
}