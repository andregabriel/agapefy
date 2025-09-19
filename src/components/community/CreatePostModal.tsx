"use client";

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ open, onOpenChange, onPostCreated }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || !user) return;

    setLoading(true);
    try {
      // Usar a função createTextPost que vamos adicionar ao hook
      const { supabase } = await import('@/lib/supabase');
      
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          post_type: 'text'
        });

      if (error) {
        console.error('❌ Erro ao criar post:', error);
        return;
      }

      console.log('✅ Post de texto criado');
      
      // Limpar e fechar
      setContent('');
      onOpenChange(false);
      onPostCreated();
      
    } catch (error) {
      console.error('💥 Erro inesperado ao criar post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setContent('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Compartilhar reflexão</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cabeçalho com avatar do usuário */}
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gray-700 text-white">
                {user?.user_metadata?.full_name?.charAt(0) || 
                 user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-white">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Você'}
              </p>
              <p className="text-xs text-gray-400">Compartilhando uma reflexão</p>
            </div>
          </div>

          {/* Campo de texto */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Compartilhe uma reflexão, versículo ou pensamento que tocou seu coração..."
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 min-h-[120px] resize-none"
            maxLength={500}
            disabled={loading}
          />

          {/* Contador de caracteres */}
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Máximo 500 caracteres</span>
            <span className={content.length > 450 ? 'text-yellow-500' : ''}>
              {content.length}/500
            </span>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}