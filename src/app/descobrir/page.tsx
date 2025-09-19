"use client";

import { useState } from 'react';
import { Search, Users, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useUserDiscovery } from '@/hooks/useUserFollow';
import UserCard from '@/components/community/UserCard';

export default function DiscoverPage() {
  const { user } = useAuth();
  const { users, loading, refetch } = useUserDiscovery();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Descobrir</h1>
          <p className="text-gray-400">Encontre pessoas para seguir na comunidade</p>
        </div>
        <Button 
          onClick={refetch}
          disabled={loading}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
          Atualizar
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          placeholder="Buscar usuários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
        />
      </div>

      {/* Lista de usuários */}
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={24} />
            <p className="text-gray-400 text-sm">Buscando usuários...</p>
          </div>
        )}

        {!loading && filteredUsers.length === 0 && searchTerm && (
          <div className="text-center py-8">
            <Search className="mx-auto mb-4 text-gray-500" size={48} />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              Nenhum usuário encontrado
            </h3>
            <p className="text-gray-500">
              Tente buscar por outro nome ou username
            </p>
          </div>
        )}

        {!loading && users.length === 0 && !searchTerm && (
          <div className="text-center py-12">
            <Users className="mx-auto mb-4 text-gray-500" size={48} />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              Nenhum usuário para descobrir
            </h3>
            <p className="text-gray-500 mb-6">
              Você já segue todos os usuários disponíveis ou é o único usuário ativo
            </p>
            <Button
              onClick={refetch}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="mr-2" size={16} />
              Verificar novamente
            </Button>
          </div>
        )}

        {!loading && filteredUsers.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                {searchTerm ? `Resultados para "${searchTerm}"` : 'Usuários sugeridos'}
              </h2>
              <span className="text-sm text-gray-400">
                {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid gap-4">
              {filteredUsers.map((suggestedUser) => (
                <UserCard
                  key={suggestedUser.id}
                  user={suggestedUser}
                  showFollowButton={true}
                  onClick={() => {
                    // TODO: Navegar para perfil do usuário
                    console.log('Ver perfil:', suggestedUser.id);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}