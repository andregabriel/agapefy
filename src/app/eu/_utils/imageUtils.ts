// Reusa o normalizador da Home (evita duplicidade e mantém o comportamento consistente).
// Observação: este helper é puro (sem React), então é seguro importar.
import { normalizeImageUrl } from '@/app/home/_utils/homeUtils';

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