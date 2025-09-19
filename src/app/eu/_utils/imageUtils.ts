// Função para normalizar URLs de imagem (copiada da home)
export const normalizeImageUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  
  // Remove espaços em branco
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;
  
  // Verifica se é uma URL válida
  try {
    new URL(cleanUrl);
    return cleanUrl;
  } catch {
    return null;
  }
};

// Função para obter URL da imagem com prioridade (baseada na home)
export const getImageUrl = (
  item: any,
  category?: { image_url?: string | null }
): string | null => {
  // Para playlists
  if (item.type === 'playlist' || item.cover_url !== undefined) {
    return normalizeImageUrl(item.cover_url) ||
           normalizeImageUrl(category?.image_url) ||
           null;
  }
  
  // Para áudios
  return normalizeImageUrl(item.thumbnail_url) ||
         normalizeImageUrl(item.cover_url) ||
         normalizeImageUrl(category?.image_url) ||
         null;
};