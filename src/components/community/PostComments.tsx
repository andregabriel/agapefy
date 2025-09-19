"use client";

import { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { type PostComment } from '@/hooks/useCommunityFeed';

interface PostCommentsProps {
  postId: string;
  fetchComments: (postId: string) => Promise<PostComment[]>;
  addComment: (postId: string, content: string) => Promise<boolean>;
  formatRelativeDate: (date: string) => string;
}

export default function PostComments({ 
  postId, 
  fetchComments, 
  addComment, 
  formatRelativeDate 
}: PostCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Carregar comentários
  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      const commentsData = await fetchComments(postId);
      setComments(commentsData);
      setLoading(false);
    };

    loadComments();
  }, [postId, fetchComments]);

  // Enviar comentário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const success = await addComment(postId, newComment.trim());
      if (success) {
        setNewComment('');
        // Recarregar comentários
        const updatedComments = await fetchComments(postId);
        setComments(updatedComments);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Lista de comentários */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin text-gray-400" size={20} />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex space-x-2">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={comment.user?.avatar_url} />
                <AvatarFallback className="bg-gray-700 text-white text-xs">
                  {comment.user?.full_name?.charAt(0) || comment.user?.username?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-800 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-gray-300 mb-1">
                    {comment.user?.full_name || comment.user?.username || 'Usuário'}
                  </p>
                  <p className="text-sm text-white break-words">
                    {comment.content}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-3">
                  {formatRelativeDate(comment.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-2">
          Seja o primeiro a comentar
        </p>
      )}

      {/* Formulário de novo comentário */}
      {user && (
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-gray-700 text-white text-xs">
              {user.user_metadata?.full_name?.charAt(0) || 'Eu'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex space-x-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicione um comentário..."
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 text-sm"
              disabled={submitting}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || submitting}
              className="bg-green-600 hover:bg-green-700 text-white px-3"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}