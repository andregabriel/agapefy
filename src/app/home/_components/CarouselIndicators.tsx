"use client";

import { useEffect, useState } from 'react';

interface CarouselIndicatorsProps {
  totalItems: number;
  currentIndex: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function CarouselIndicators({ totalItems, currentIndex, containerRef }: CarouselIndicatorsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Só mostrar se for mobile e tiver mais de 1 item
  if (!isMobile || totalItems <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center gap-1.5 mt-4 md:hidden">
      {Array.from({ length: totalItems }).map((_, index) => (
        <button
          key={index}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            index === currentIndex
              ? 'bg-white scale-125'
              : 'bg-white/40 hover:bg-white/60'
          }`}
          onClick={() => {
            if (containerRef.current) {
              const container = containerRef.current;
              const itemWidth = container.scrollWidth / totalItems;
              container.scrollTo({
                left: itemWidth * index,
                behavior: 'smooth'
              });
            }
          }}
          aria-label={`Ir para item ${index + 1}`}
        />
      ))}
    </div>
  );
}