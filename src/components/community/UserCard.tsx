"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, UserMinus, Users, MessageSquare } from 'lucide-react';
import { useUserFollow } from '@/hooks/useUserFollow';
import { useAuth } from '@/contexts/AuthContext';

interface UserCardProps {
  user: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  showFollowButton?: boolean;
  onClick?: () => void;
}

export default function UserCard({ user, showFollowButton = true, onClick }: UserCardProps) {
  const { user: currentUser } = useAuth();
  const { stats, loading, toggleFollow } = useUserFollow(user.id);
  const [isHovered, setIsHovered] = useState(false);

  const isOwnProfile = currentUser?.id === user.id;
  const displayName = user.full_name || user.username || 'Usuário';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFollow();
  };

  return (
    <Card 
      className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.avatar_url || ''} alt={displayName} />
            <AvatarFallback className="bg-gray-700 text-gray-300">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Informações do usuário */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white truncate">
                  {displayName}
                </h3>
                {user.username && user.username !== user.full_name && (
                  <p className="text-sm text-gray-400">@{user.username}</p>
                )}
              </div>

              {/* Botão de seguir */}
              {showFollowButton && !isOwnProfile && (
                <Button
                  size="sm"
                  variant={stats.isFollowing ? "outline" : "default"}
                  onClick={handleFollowClick}
                  disabled={loading}
                  className={`ml-2 ${
                    stats.isFollowing 
                      ? 'border-gray-600 text-gray-300 hover:bg-red-900/20 hover:border-red-600 hover:text-red-400' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : stats.isFollowing ? (
                    <>
                      {isHovered ? (
                        <>
                          <UserMinus size={14} className="mr-1" />
                          Deixar de seguir
                        </>
                      ) : (
                        <>
                          <Users size={14} className="mr-1" />
                          Seguindo
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} className="mr-1" />
                      Seguir
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {user.bio}
              </p>
            )}

            {/* Estatísticas */}
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Users size={14} className="text-gray-500" />
                <span className="text-xs text-gray-400">
                  {stats.followersCount} seguidores
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare size={14} className="text-gray-500" />
                <span className="text-xs text-gray-400">
                  {stats.followingCount} seguindo
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}