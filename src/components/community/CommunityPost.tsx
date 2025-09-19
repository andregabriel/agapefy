"use client";

import { useState } from 'react';
import { Heart, MessageCircle, Music, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { type CommunityPost } from '@/hooks/useCommunityFeed';
import PostComments from './PostComments';

interface CommunityPostProps {
  post: CommunityPost;
  onLike: (postId: string) => Promise<boolean>;
  onIntercede: (postId: string) => Promise<boolean>;
  fetchPostComments: (postId: string) => Promise<any[]>;
  addComment: (postId: string, content: string) => Promise<boolean>;
  formatRelativeDate: (date: string) => string;
}

export default function CommunityPost({ 
  post, 
  onLike, 
  onIntercede, 
  fetchPostComments,
  addComment,
  formatRelativeDate 
}: CommunityPostProps) {
  const [likingLoading, setLikingLoading] = useState(false);
  const [intercedingLoading, setIntercedingLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    setLikingLoading(true);
    try {
      await onLike(post.id);
    } finally {
      setLikingLoading(false);
    }
  };

  const handleIntercede = async () => {
    console.log('🙏 Clicou em interceder para post:', post.id);
    setIntercedingLoading(true);
    try {
      const success = await onIntercede(post.id);
      console.log('🙏 Resultado da intercessão:', success);
    } catch (error) {
      console.error('❌ Erro ao interceder:', error);
    } finally {
      setIntercedingLoading(false);
    }
  };

  const handleToggleComments = () => {
    setShowComments(!showComments);
  };

  const renderPostContent = () => {
    switch (post.post_type) {
      case 'prayer':
        return (
          <div>
            <p className="text-white mb-3">
              {post.content || `rezou com ${post.audio?.title || 'uma oração'}`}
            </p>
            {post.audio && (
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2">
                  <Music size={16} className="text-green-500" />
                  <div>
                    <p className="text-sm text-gray-300 font-medium">{post.audio.title}</p>
                    {post.audio.subtitle && (
                      <p className="text-xs text-gray-400">{post.audio.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'intention':
        return (
          <div>
            <p className="text-white mb-3">adicionou uma intenção de oração</p>
            {post.intention && (
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-300 font-medium mb-1">🙏 {post.intention.title}</p>
                {post.intention.description && (
                  <p className="text-xs text-gray-400">{post.intention.description}</p>
                )}
              </div>
            )}
          </div>
        );

      case 'text':
        return (
          <div>
            <p className="text-white mb-3 whitespace-pre-wrap leading-relaxed">
              {post.content}
            </p>
          </div>
        );

      default:
        return (
          <p className="text-white mb-3">{post.content}</p>
        );
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      {/* Cabeçalho do post */}
      <div className="flex items-center space-x-3 mb-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.user?.avatar_url} />
          <AvatarFallback className="bg-gray-700 text-white">
            {post.user?.full_name?.charAt(0) || post.user?.username?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h4 className="font-semibold text-white">
            {post.user?.full_name || post.user?.username || 'Usuário'}
          </h4>
          <p className="text-xs text-gray-400">{formatRelativeDate(post.created_at)}</p>
        </div>
      </div>

      {/* Conteúdo do post */}
      {renderPostContent()}

      {/* Ações */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLike}
            disabled={likingLoading}
            className={`text-gray-400 hover:text-red-500 ${post.user_liked ? 'text-red-500' : ''}`}
          >
            {likingLoading ? (
              <Loader2 size={16} className="mr-1 animate-spin" />
            ) : (
              <Heart size={16} className={`mr-1 ${post.user_liked ? 'fill-current' : ''}`} />
            )}
            {post.likes_count}
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleToggleComments}
            className="text-gray-400 hover:text-blue-500"
          >
            <MessageCircle size={16} className="mr-1" />
            {post.comments_count}
            {showComments ? (
              <ChevronUp size={14} className="ml-1" />
            ) : (
              <ChevronDown size={14} className="ml-1" />
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleIntercede}
            disabled={intercedingLoading}
            className={`text-gray-400 hover:text-green-500 ${post.user_interceded ? 'text-green-500' : ''}`}
          >
            {intercedingLoading ? (
              <Loader2 size={16} className="mr-1 animate-spin" />
            ) : (
              <span className="mr-1">🙏</span>
            )}
            {post.user_interceded ? 'Orei por você' : 'Rezar por você'}
            {post.intercessions_count > 0 && ` (${post.intercessions_count})`}
          </Button>
        </div>
      </div>

      {/* Seção de comentários */}
      {showComments && (
        <div className="border-t border-gray-800 pt-3">
          <PostComments
            postId={post.id}
            fetchComments={fetchPostComments}
            addComment={addComment}
            formatRelativeDate={formatRelativeDate}
          />
        </div>
      )}
    </div>
  );
}