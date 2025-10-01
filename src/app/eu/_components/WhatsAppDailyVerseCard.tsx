"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function WhatsAppDailyVerseCard({ defaultSendTime = '09:00' }: { defaultSendTime?: string }) {
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('whatsapp_users')
          .select('phone_number, is_active, receives_daily_verse')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          setPhone(data[0].phone_number || '');
          setEnabled(Boolean(data[0].receives_daily_verse));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const normalized = normalizePhone(phone);
      if (enabled && !normalized) {
        toast.error('Informe seu WhatsApp para receber o versículo.');
        return;
      }
      const { error } = await supabase
        .from('whatsapp_users')
        .upsert({
          phone_number: normalized || null,
          is_active: true,
          receives_daily_verse: enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'phone_number' });
      if (error) throw error;
      toast.success('Preferências salvas.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Versículo diário no WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Número do WhatsApp (com DDI)</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex.: 5511999999999"
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium">Receber versículo no WhatsApp</div>
            <div className="text-sm text-gray-400">Você receberá o versículo às {defaultSendTime} (horário de São Paulo).</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
        </div>
        <div className="pt-1">
          <Button onClick={save} disabled={saving || loading} className="w-full">Salvar preferências</Button>
        </div>
      </CardContent>
    </Card>
  );
}
