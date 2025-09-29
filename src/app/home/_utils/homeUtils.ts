export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return url;
}

export function deduplicateById<T extends { id?: string; type?: string; title?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it?.id || `${it?.type}:${it?.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds === 0) return '0 min';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function formatAudioCount(count: number | null | undefined): string {
  if (!count || count === 0) return '0 orações';
  if (count === 1) return '1 oração';
  return `${count} orações`;
}

export function getLayoutClasses(layoutType: string) {
  switch (layoutType) {
    case 'grid_3_rows':
      return {
        containerClass: 'grid grid-rows-3 grid-flow-col auto-cols-[6.5rem] gap-3 overflow-x-auto scrollbar-hide pb-3 scroll-smooth snap-x snap-mandatory md:auto-cols-[12rem] md:gap-6 md:pb-4 md:px-16',
        cardClass: 'flex-shrink-0 w-24 snap-start cursor-pointer group md:w-48',
        thumbnailClass: 'w-24 h-24 rounded-lg overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center md:w-48 md:h-48',
        imageMarginClass: 'mb-2 md:mb-4',
        titleClass: 'font-semibold text-white text-[13px] leading-tight truncate group-hover:underline md:font-bold md:text-base',
        subtitleClass: 'text-[11px] text-gray-300 truncate md:text-sm',
        metaClass: 'text-[11px] text-gray-400 md:text-sm'
      };
    case 'full':
      return {
        containerClass: 'flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory md:px-16',
        cardClass: 'flex-shrink-0 w-full sm:w-96 snap-start cursor-pointer group',
        thumbnailClass: 'w-full h-96 rounded-lg overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center'
      };
    case 'double_height':
      return {
        containerClass: 'flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory md:px-16',
        cardClass: 'flex-shrink-0 w-48 snap-start cursor-pointer group',
        thumbnailClass: 'w-48 h-96 rounded-lg overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center'
      };
    default: // spotify
      return {
        containerClass: 'flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory md:px-16',
        cardClass: 'flex-shrink-0 w-48 snap-start cursor-pointer group',
        thumbnailClass: 'w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center'
      };
  }
}