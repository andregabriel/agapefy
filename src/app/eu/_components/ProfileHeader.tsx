"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import Link from 'next/link';

interface ProfileHeaderProps {
  user: any;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center space-x-3 mb-2">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.user_metadata?.avatar_url} />
          <AvatarFallback className="bg-gray-700 text-white text-sm">
            {user.email?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="text-left">
          <h1 className="text-lg font-bold text-white">
            {user.user_metadata?.full_name || user.email?.split('@')[0]}
          </h1>
          <p className="text-sm text-gray-400">{user.email}</p>
        </div>
        
        <div className="flex space-x-2 ml-auto">
          <Link href="/eu/config">
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-800">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}