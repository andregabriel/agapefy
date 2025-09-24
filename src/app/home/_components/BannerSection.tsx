"use client";

import Link from 'next/link';
import React from 'react';

interface BannerSectionProps {
  title: string;
  imageUrl: string;
  href: string;
}

export function BannerSection({ title, imageUrl, href }: BannerSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <Link href={href} className="block group">
        <img
          src={imageUrl}
          alt={title}
          className="w-full rounded-xl overflow-hidden border border-white/10 shadow-lg transition-transform duration-200 group-active:scale-[0.99]"
        />
      </Link>
    </section>
  );
}


