"use client";

import Link from 'next/link';
import React from 'react';
import { normalizeImageUrl } from '../_utils/homeUtils';

interface BannerSectionProps {
  title: string;
  imageUrl: string;
  href: string;
  isPriority?: boolean;
}

export function BannerSection({ title, imageUrl, href, isPriority }: BannerSectionProps) {
  const quality = 70;
  const src1x = normalizeImageUrl(imageUrl, { width: 1200, quality }) || imageUrl;
  const src2x = normalizeImageUrl(imageUrl, { width: 2400, quality }) || imageUrl;

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <Link href={href} className="block group">
        <img
          src={src1x}
          srcSet={`${src1x} 1x, ${src2x} 2x`}
          alt={title}
          className="w-full rounded-xl overflow-hidden border border-white/10 shadow-lg transition-transform duration-200 group-active:scale-[0.99]"
          loading={isPriority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={isPriority ? 'high' : undefined}
        />
      </Link>
    </section>
  );
}


