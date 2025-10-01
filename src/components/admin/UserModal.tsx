"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface UserModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function UserModal({ user, isOpen, onClose, onSave }: UserModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    role: 'user',
    bio: '',
  });
  const [loading, setLoading] = useState(false);

  // Helpers para draft persistence
  const getDraftKey = () => {
    const base = 'admin.draft.user';
    if (user?.id) return `${base}.edit.${user.id}`;
    return `${base}.new`;
  };

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        username: user.username || '',
        role: user.role || 'user',
        bio: user.bio || '',
      });
    } else {
      setFormData({
        full_name: '',
        username: '',
        role: 'user',
        bio: '',
      });
    }
  }, [user]);

  // Restaurar draft ao abrir modal
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        setFormData(prev => ({ ...prev, ...draft }));
      }
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  // Salvar draft quando editar campos com modal aberto
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isOpen, user?.id]);

  const clearDraft = () => {
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.removeItem(key);
    } catch (_) {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            username: formData.username,
            role: formData.role,
            bio: formData.bio,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Criar novo usuário (apenas perfil, pois não podemos criar auth.users diretamente)
        alert('Para criar novos usuários, eles devem se registrar pela página de login.');
        onClose();
        return;
      }

      onSave();
      clearDraft();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      alert('Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {user ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button onClick={() => { clearDraft(); onClose(); }} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => { clearDraft(); onClose(); }}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}