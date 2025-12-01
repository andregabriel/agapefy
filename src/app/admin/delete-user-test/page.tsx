'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function DeleteUserTestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('andre@agapepray.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja deletar o usuário ${email}? Esta ação não pode ser desfeita!`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar usuário');
      }

      setResult(`✅ Usuário ${email} deletado com sucesso! ID: ${data.userId}`);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Deletar Usuário</h1>
        <p>Você precisa estar logado para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Deletar Usuário (Teste)</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Atenção:</strong> Esta página é temporária para testes. Após usar, delete este arquivo.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Email do usuário a deletar:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="email@exemplo.com"
          />
        </div>

        <button
          onClick={handleDelete}
          disabled={loading || !email}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Deletando...' : 'Deletar Usuário'}
        </button>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{result}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="font-semibold mb-2">Alternativa: Executar SQL diretamente</h2>
        <p className="text-sm text-gray-600 mb-2">
          Se preferir, você pode executar o SQL diretamente no Supabase SQL Editor:
        </p>
        <code className="text-xs bg-white p-2 rounded block overflow-x-auto">
          Ver arquivo: scripts/delete-user.sql
        </code>
      </div>
    </div>
  );
}

