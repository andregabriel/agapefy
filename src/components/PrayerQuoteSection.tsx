"use client";

import React from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Heart } from 'lucide-react';

export function PrayerQuoteSection() {
  const { settings, loading } = useAppSettings();

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <Heart className="text-blue-600" size={24} />
        </div>
        <p className="text-gray-700 font-medium text-lg mb-2 italic">
          {settings.prayer_quote_text}
        </p>
        <p className="text-blue-600 font-semibold text-sm">
          {settings.prayer_quote_reference}
        </p>
      </div>
    </div>
  );
}