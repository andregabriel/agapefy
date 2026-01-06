import { supabase } from '@/lib/supabase';
import { logDbError } from '@/lib/utils';
import { logger } from '@/lib/logger';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  order_position?: number;
  is_featured?: boolean;
  layout_type?: string;
  is_visible?: boolean;
}

export interface Audio {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  audio_url: string;
  cover_url?: string | null; // NOVO CAMPO ADICIONADO
  thumbnail_url?: string | null; // Thumbnail 1:1 para exibição na home
  duration: number | null;
  transcript: string | null;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
  // Ordem opcional de exibição combinada (áudios + playlists) na home
  display_order?: number;
  time?: 'Wakeup' | 'Lunch' | 'Dinner' | 'Sleep' | 'Any' | null;
  spiritual_goal?: string | null;
  voice_id?: string | null;
  voice_name?: string | null;
  category?: Category;
}

export interface Playlist {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category_id: string | null;
  category_ids?: string[];
  created_by: string | null;
  is_public: boolean;
  created_at: string;
  // Ordem opcional de exibição combinada (áudios + playlists) na home
  display_order?: number;
  category?: Category;
  audios?: Audio[];
  total_duration?: number;
  audio_count?: number;
  is_challenge?: boolean;
}

function normalizePlaylistCategories<T extends { category_ids?: string[] | null; category_id?: string | null }>(
  playlist: T
): T & { category_ids: string[] } {
  const array = Array.isArray(playlist.category_ids)
    ? playlist.category_ids.filter(Boolean)
    : playlist.category_id
      ? [playlist.category_id]
      : [];
  const category_ids = Array.from(new Set(array));
  return { ...(playlist as any), category_ids };
}

export interface CategoryHomeOrderItem {
  type: 'audio' | 'playlist';
  id: string;
}

// Buscar todas as categorias ordenadas com categoria fixa primeiro
export async function getCategories(): Promise<Category[]> {
  logger.debug('🔍 Buscando categorias com ordem: fixa primeiro, depois manual...');
  
  // Query principal (usa colunas modernas)
  let { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('is_featured', { ascending: false }) // Categoria fixa primeiro
    .order('order_position', { ascending: true }); // Depois ordem manual

  // Fallback se coluna ainda não existir no banco do ambiente
  if (error) {
    logDbError('❌ Erro ao buscar categorias (tentativa principal)', error);
    const fallback = await supabase
      .from('categories')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true });
    if (fallback.error) {
      logDbError('❌ Erro ao buscar categorias (fallback)', fallback.error);
      return [];
    }
    data = fallback.data as any[];
  }

  logger.debug('✅ Categorias encontradas:', data?.length || 0);
  logger.debug('📋 Lista de categorias ordenadas:', data?.map((cat: any) => ({ 
    id: cat.id, 
    name: cat.name, 
    position: cat.order_position,
    featured: cat.is_featured,
    layout: cat.layout_type 
  })));

  return (data as Category[]) || [];
}

// Banner helpers (category -> link mapping stored in app_settings)
export async function getCategoryBannerLinks(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'category_banner_link:%');

    if (error) {
      logDbError('Erro ao buscar links de banner', error);
      return {};
    }

    const map: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      const match = /^category_banner_link:(.+)$/.exec(row.key);
      if (match && row.value) {
        map[match[1]] = row.value as string;
      }
    });
    return map;
  } catch (err) {
    logDbError('Erro inesperado ao buscar links de banner', err);
    return {};
  }
}

// --- Ordem combinada de conteúdo da home (áudios + playlists) por categoria ---

function parseHomeOrderValue(raw: any): CategoryHomeOrderItem[] {
  if (!raw) return [];

  try {
    // Se vier como string (ex: coluna value é text), tentar fazer parse
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];

    return value
      .map((item: any) => ({
        type: item?.type,
        id: item?.id
      }))
      .filter(
        (item: any): item is CategoryHomeOrderItem =>
          (item.type === 'audio' || item.type === 'playlist') &&
          typeof item.id === 'string' &&
          item.id.length > 0
      );
  } catch (err) {
    logDbError('Erro ao fazer parse de home_content_order', err);
    return [];
  }
}

// Buscar ordem da home para uma categoria específica
export async function getCategoryHomeOrder(categoryId: string): Promise<CategoryHomeOrderItem[]> {
  if (!categoryId) return [];

  try {
    const key = `home_content_order:${categoryId}`;
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      logDbError('Erro ao buscar ordem da home para categoria', error);
      return [];
    }

    if (!data || data.value == null) return [];
    return parseHomeOrderValue((data as any).value);
  } catch (err) {
    logDbError('Erro inesperado ao buscar ordem da home para categoria', err);
    return [];
  }
}

// Salvar / atualizar ordem da home para uma categoria
export async function saveCategoryHomeOrder(
  categoryId: string,
  items: CategoryHomeOrderItem[]
): Promise<{ success: boolean; error?: string }> {
  if (!categoryId) return { success: false, error: 'categoryId inválido' };

  try {
    const key = `home_content_order:${categoryId}`;
    const payload = items.map((item) => ({
      type: item.type,
      id: item.id
    }));

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key, value: payload, type: 'json' },
        { onConflict: 'key' }
      );

    if (error) {
      logDbError('Erro ao salvar ordem da home para categoria', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logDbError('Erro inesperado ao salvar ordem da home para categoria', err);
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}

// Remover ordem customizada (voltar para ordem padrão por created_at)
export async function deleteCategoryHomeOrder(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  if (!categoryId) return { success: false, error: 'categoryId inválido' };

  try {
    const key = `home_content_order:${categoryId}`;
    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('key', key);

    if (error) {
      logDbError('Erro ao remover ordem da home para categoria', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logDbError('Erro inesperado ao remover ordem da home para categoria', err);
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}

// Buscar ordens de home para todas as categorias em uma única chamada
export async function getAllCategoryHomeOrders(): Promise<Record<string, CategoryHomeOrderItem[]>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'home_content_order:%');

    if (error) {
      logDbError('Erro ao buscar ordens da home para categorias', error);
      return {};
    }

    const map: Record<string, CategoryHomeOrderItem[]> = {};

    (data || []).forEach((row: any) => {
      const match = /^home_content_order:(.+)$/.exec(row.key);
      if (!match) return;
      const categoryId = match[1];
      const items = parseHomeOrderValue(row.value);
      if (items.length > 0) {
        map[categoryId] = items;
      }
    });

    return map;
  } catch (err) {
    logDbError('Erro inesperado ao buscar ordens da home para categorias', err);
    return {};
  }
}

export async function upsertCategoryBannerLink(categoryId: string, linkUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: `category_banner_link:${categoryId}`, value: linkUrl, type: 'text' }, { onConflict: 'key' });
    if (error) {
      console.error('Erro ao salvar link do banner:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}

export async function deleteCategoryBannerLink(categoryId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('key', `category_banner_link:${categoryId}`);
    if (error) {
      console.error('Erro ao remover link do banner:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}

// Buscar playlists públicas
export async function getPublicPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro ao buscar playlists:', error);
    return [];
  }
  
  // O campo is_challenge já vem direto da query
  return (data as Playlist[]) || [];
}

// Buscar áudios por categoria
export async function getAudiosByCategory(categoryId: string): Promise<Audio[]> {
  logger.debug('🎵 Buscando áudios da categoria:', categoryId);
  
  const { data, error } = await supabase
    .from('audios')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar áudios:', error);
    return [];
  }

  logger.debug('✅ Áudios encontrados na categoria:', data?.length || 0);
  return (data as Audio[]) || [];
}

// Buscar áudios (rápido, somente colunas necessárias para lista)
export async function getAudiosByCategoryFast(categoryId: string): Promise<Pick<Audio, 'id' | 'title' | 'subtitle' | 'duration' | 'category_id' | 'created_at' | 'cover_url' | 'thumbnail_url'>[]> {
  // Primeiro tenta buscar com thumbnail_url; se a coluna não existir no banco, faz fallback sem ela
  let query = supabase
    .from('audios')
    .select('id,title,subtitle,duration,category_id,created_at,cover_url,thumbnail_url')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  let { data, error } = await query;

  if (error) {
    console.warn('getAudiosByCategoryFast: fallback sem thumbnail_url (coluna pode não existir). Detalhes:', error?.message);
    const fallback = await supabase
      .from('audios')
      .select('id,title,subtitle,duration,category_id,created_at,cover_url')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false });
    if (fallback.error) {
      console.error('Erro ao buscar áudios (fast):', fallback.error);
      return [];
    }
    return (fallback.data as any[]) || [];
  }
  return (data as any[]) || [];
}

// Buscar áudios para várias categorias em uma única requisição (fast)
export async function getAudiosByCategoryBulkFast(categoryIds: string[]): Promise<Record<string, Pick<Audio, 'id' | 'title' | 'subtitle' | 'duration' | 'category_id' | 'created_at' | 'cover_url' | 'thumbnail_url'>[]>> {
  if (!categoryIds.length) return {};

  // Tenta com thumbnail_url e faz fallback sem caso a coluna não exista
  let { data, error } = await supabase
    .from('audios')
    .select('id,title,subtitle,duration,category_id,created_at,cover_url,thumbnail_url')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getAudiosByCategoryBulkFast: fallback sem thumbnail_url (coluna pode não existir). Detalhes:', error?.message);
    const fallback = await supabase
      .from('audios')
      .select('id,title,subtitle,duration,category_id,created_at,cover_url')
      .in('category_id', categoryIds)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      console.error('Erro ao buscar áudios em lote (fast):', fallback.error);
      return {};
    }
    data = fallback.data as any[];
  }

  const map: Record<string, any[]> = {};
  ((data as any[]) || []).forEach((row) => {
    const cid = row.category_id as string | null;
    if (!cid) return;
    if (!map[cid]) map[cid] = [];
    map[cid].push(row);
  });
  return map;
}

// Função para calcular duração total de uma playlist
export async function getPlaylistDuration(playlistId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('playlist_audios')
      .select(`
        audios(duration)
      `)
      .eq('playlist_id', playlistId);

    if (error) {
      console.error('Erro ao buscar duração da playlist:', error);
      return 0;
    }

    // Somar durações de todos os áudios
    const totalDuration = data?.reduce((total: number, item: any) => {
      const audioDuration = item.audios?.duration || 0;
      return total + audioDuration;
    }, 0) || 0;

    return totalDuration;
  } catch (error) {
    console.error('Erro ao calcular duração da playlist:', error);
    return 0;
  }
}

// Função para contar áudios de uma playlist
export async function getPlaylistAudioCount(playlistId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('playlist_audios')
      .select('audio_id')
      .eq('playlist_id', playlistId);

    if (error) {
      console.error('Erro ao contar áudios da playlist:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Erro ao contar áudios da playlist:', error);
    return 0;
  }
}

// Buscar playlists públicas por categoria com duração e contagem
export async function getPlaylistsByCategory(categoryId: string): Promise<Playlist[]> {
  logger.debug('📋 Buscando playlists da categoria:', categoryId);
  
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      category:categories(*)
    `)
    .contains('category_ids', [categoryId])
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists da categoria:', error);
    return [];
  }

  const normalized = (data || []).map((playlist: any) => normalizePlaylistCategories(playlist));

  // Calcular duração e contagem para cada playlist
  const playlistsWithData = await Promise.all(
    normalized.map(async (playlist: any) => {
      const [totalDuration, audioCount] = await Promise.all([
        getPlaylistDuration(playlist.id),
        getPlaylistAudioCount(playlist.id)
      ]);
      
      return {
        ...playlist,
        total_duration: totalDuration,
        audio_count: audioCount
      };
    })
  );

  // O campo is_challenge já vem direto da query
  logger.debug('✅ Playlists encontradas na categoria:', playlistsWithData?.length || 0);
  return playlistsWithData as Playlist[];
}

// Buscar playlists públicas por categoria (rápido, sem estatísticas de duração/contagem)
export async function getPlaylistsByCategoryFast(categoryId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('id,title,description,category_id,category_ids,created_at,is_public,cover_url')
    .contains('category_ids', [categoryId])
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists da categoria (fast):', error);
    return [];
  }

  const rows = ((data as Playlist[]) || []).map((p) => normalizePlaylistCategories(p));
  if (!rows.length) return rows;

  // Anexar contagem de áudios de forma leve (1 query adicional, agrupada)
  try {
    const playlistIds = rows.map((p) => p.id);
    const { data: paRows, error: paErr } = await supabase
      .from('playlist_audios')
      .select('playlist_id')
      .in('playlist_id', playlistIds);

    if (paErr) {
      console.warn('Falha ao buscar contagem de áudios (fast):', paErr);
      return rows;
    }

    const counts: Record<string, number> = {};
    (paRows || []).forEach((r: any) => {
      const pid = r.playlist_id as string;
      counts[pid] = (counts[pid] || 0) + 1;
    });

    // O campo is_challenge já vem direto da query
    return rows.map((p) => ({ ...p, audio_count: counts[p.id] || 0 }));
  } catch (e) {
    console.warn('Erro inesperado ao anexar contagem de áudios (fast):', e);
    return rows;
  }
}

// Buscar playlists para várias categorias em uma única requisição (fast)
export async function getPlaylistsByCategoryBulkFast(categoryIds: string[]): Promise<Record<string, Playlist[]>> {
  if (!categoryIds.length) return {};

  const { data, error } = await supabase
    .from('playlists')
    .select('id,title,description,category_id,category_ids,created_at,is_public,cover_url')
    .overlaps('category_ids', categoryIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists em lote (fast):', error);
    return {};
  }

  const rows = ((data as any[]) || []).map((p) => normalizePlaylistCategories(p)) as Playlist[];
  if (!rows.length) return {};

  // Buscar contagens de áudios para todas as playlists envolvidas em uma única query
  try {
    const playlistIds = rows.map((p) => p.id);
    const { data: paRows, error: paErr } = await supabase
      .from('playlist_audios')
      .select('playlist_id')
      .in('playlist_id', playlistIds);

    if (paErr) {
      console.warn('Falha ao buscar contagem de áudios (bulk fast):', paErr);
    }

    const counts: Record<string, number> = {};
    (paRows || []).forEach((r: any) => {
      const pid = r.playlist_id as string;
      counts[pid] = (counts[pid] || 0) + 1;
    });

    // O campo is_challenge já vem direto da query
    const map: Record<string, Playlist[]> = {};
    rows.forEach((row: any) => {
      const ids = Array.isArray(row.category_ids) ? row.category_ids : [];
      ids
        .filter((cid) => categoryIds.includes(cid))
        .forEach((cid) => {
          if (!map[cid]) map[cid] = [];
          map[cid].push({ ...row, audio_count: counts[row.id] || 0 });
        });
    });
    return map;
  } catch (e) {
    console.warn('Erro inesperado ao anexar contagem de áudios (bulk fast):', e);
    const map: Record<string, Playlist[]> = {};
    rows.forEach((row: any) => {
      const ids = Array.isArray(row.category_ids) ? row.category_ids : [];
      ids
        .filter((cid) => categoryIds.includes(cid))
        .forEach((cid) => {
          if (!map[cid]) map[cid] = [];
          map[cid].push(row as Playlist);
        });
    });
    return map;
  }
}

// Buscar áudios E playlists por categoria (função combinada)
export async function getCategoryContent(categoryId: string): Promise<{
  audios: Audio[];
  playlists: Playlist[];
}> {
  logger.debug('🔍 Buscando conteúdo completo da categoria:', categoryId);
  
  // Buscar áudios e playlists em paralelo
  const [audios, playlists] = await Promise.all([
    getAudiosByCategory(categoryId),
    getPlaylistsByCategory(categoryId)
  ]);

  logger.debug(`✅ Categoria ${categoryId}: ${audios.length} áudios + ${playlists.length} playlists`);
  
  return {
    audios,
    playlists
  };
}

// Buscar conteúdo da categoria rapidamente (sem estatísticas pesadas)
export async function getCategoryContentFast(categoryId: string): Promise<{
  audios: Audio[];
  playlists: Playlist[];
}> {
  // Evita o custo das estatísticas por playlist no carregamento inicial
  const [audios, playlists] = await Promise.all([
    getAudiosByCategoryFast(categoryId) as unknown as Audio[],
    getPlaylistsByCategoryFast(categoryId)
  ]);

  return {
    audios,
    playlists
  };
}

// Buscar conteúdo de várias categorias rapidamente (2 queries totais)
export async function getCategoriesContentFastBulk(categoryIds: string[]): Promise<Record<string, { audios: Audio[]; playlists: Playlist[] }>> {
  if (!categoryIds.length) return {};

  const [audioMap, playlistMap] = await Promise.all([
    getAudiosByCategoryBulkFast(categoryIds),
    getPlaylistsByCategoryBulkFast(categoryIds)
  ]);

  const result: Record<string, { audios: Audio[]; playlists: Playlist[] }> = {};
  categoryIds.forEach((id) => {
    result[id] = {
      audios: (audioMap[id] as unknown as Audio[]) || [],
      playlists: (playlistMap[id] as Playlist[]) || []
    };
  });
  return result;
}

// Buscar áudios com busca por texto
export async function searchAudios(searchTerm: string, categoryId?: string): Promise<Audio[]> {
  let query = supabase
    .from('audios')
    .select(`
      *,
      category:categories(*)
    `);

  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,subtitle.ilike.%${searchTerm}%`);
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao buscar áudios:', error);
    return [];
  }

  return (data as Audio[]) || [];
}

// Buscar playlists com busca por texto
export async function searchPlaylists(searchTerm: string, categoryId?: string): Promise<Playlist[]> {
  let query = supabase
    .from('playlists')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('is_public', true);

  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }

  if (categoryId) {
    query = query.contains('category_ids', [categoryId]);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao buscar playlists:', error);
    return [];
  }

  // Calcular duração e contagem para cada playlist
  const normalized = (data || []).map((playlist: any) => normalizePlaylistCategories(playlist));

  const playlistsWithData = await Promise.all(
    normalized.map(async (playlist: any) => {
      const [totalDuration, audioCount] = await Promise.all([
        getPlaylistDuration(playlist.id),
        getPlaylistAudioCount(playlist.id)
      ]);
      
      return {
        ...playlist,
        total_duration: totalDuration,
        audio_count: audioCount
      };
    })
  );
  // O campo is_challenge já vem direto da query
  return playlistsWithData as Playlist[];
}

// Buscar categorias com busca por texto
export async function searchCategories(searchTerm: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('is_featured', { ascending: false }) // Categoria fixa primeiro
    .order('order_position', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Erro ao buscar categorias:', error);
    return [];
  }

  return (data as Category[]) || [];
}

// Busca unificada (áudios + playlists + categorias)
export async function searchAll(searchTerm: string): Promise<{
  audios: Audio[];
  playlists: Playlist[];
  categories: Category[];
}> {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return {
      audios: [],
      playlists: [],
      categories: []
    };
  }

  const trimmedTerm = searchTerm.trim();

  // Buscar em paralelo para melhor performance
  const [audios, playlists, categories] = await Promise.all([
    searchAudios(trimmedTerm),
    searchPlaylists(trimmedTerm),
    searchCategories(trimmedTerm)
  ]);

  logger.debug(`🔍 Busca "${trimmedTerm}": ${audios.length} áudios, ${playlists.length} playlists, ${categories.length} categorias`);

  return {
    audios,
    playlists,
    categories
  };
}

// Buscar playlist com áudios
export async function getPlaylistWithAudios(playlistId: string): Promise<(Playlist & { audios: Audio[] }) | null> {
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      category:categories(*),
      playlist_audios(
        position,
        audio:audios(*)
      )
    `)
    .eq('id', playlistId)
    .single();

  if (error) {
    console.error('Erro ao buscar playlist:', error);
    return null;
  }

  // Ordenar áudios por posição
  const audios = data.playlist_audios
    ?.sort((a: any, b: any) => a.position - b.position)
    .map((pa: any) => pa.audio) || [];

  // O campo is_challenge já vem direto da query
  return {
    ...normalizePlaylistCategories(data),
    audios
  } as Playlist & { audios: Audio[] };
}

// Buscar áudios aleatórios para recomendações
export async function getRandomAudios(limit: number = 6): Promise<Audio[]> {
  const { data, error } = await supabase
    .from('audios')
    .select(`
      *,
      category:categories(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar áudios aleatórios:', error);
    return [];
  }

  return (data as Audio[]) || [];
}

// Função para forçar recarregamento das categorias (útil para debug)
export async function refreshCategories(): Promise<Category[]> {
  logger.debug('🔄 Forçando recarregamento das categorias...');
  return await getCategories();
}

// --- Helpers de playlist para /admin/gm ---
function normalizeInsensitive(input: string): string {
  return (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function findPlaylistByTitleInsensitive(title: string): Promise<Playlist | null> {
  const needle = normalizeInsensitive(title);
  if (!needle) return null;

  const { data, error } = await supabase
    .from('playlists')
    .select('id,title,description,cover_url,category_id,category_ids,created_by,is_public,created_at')
    .ilike('title', `%${title}%`);

  if (error) {
    console.error('Erro ao buscar playlist por título:', error);
    return null;
  }

  const rows: any[] = data || [];
  const exact = rows.find(row => normalizeInsensitive(row.title) === needle);
  return exact ? (normalizePlaylistCategories(exact) as Playlist) : null;
}

export async function addAudioToPlaylist(audioId: string, playlistId: string): Promise<{ success: boolean; error?: string }> {
  if (!audioId || !playlistId) return { success: false, error: 'IDs inválidos' };

  const { data: exists, error: selErr } = await supabase
    .from('playlist_audios')
    .select('audio_id')
    .eq('audio_id', audioId)
    .eq('playlist_id', playlistId)
    .maybeSingle();

  if (selErr) {
    console.warn('Falha ao verificar associação de playlist:', selErr);
  }
  if (exists) return { success: true };

  const { error: insErr } = await supabase
    .from('playlist_audios')
    .insert({ audio_id: audioId, playlist_id: playlistId });

  if (insErr) return { success: false, error: insErr.message };
  return { success: true };
}

export async function createPlaylist(title: string, categoryId?: string | null): Promise<Playlist | null> {
  const safeTitle = (title || '').toString().trim();
  if (!safeTitle) return null;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const createdBy = auth?.user?.id || null;

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        title: safeTitle,
        description: null,
        cover_url: null,
        category_id: categoryId || null,
        category_ids: categoryId ? [categoryId] : [],
        created_by: createdBy,
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar playlist:', error);
      return null;
    }
    return (data as unknown) as Playlist;
  } catch (e) {
    console.error('Falha inesperada ao criar playlist:', e);
    return null;
  }
}

export async function ensurePlaylistByTitleInsensitive(title: string, categoryId?: string | null): Promise<Playlist | null> {
  const existing = await findPlaylistByTitleInsensitive(title);
  if (existing) return existing;
  return await createPlaylist(title, categoryId || null);
}

// --- Challenge helpers ---
export async function markPlaylistAsChallenge(playlistId: string): Promise<{ success: boolean; error?: string }> {
  // Feature desativada: não usar tabela challenge
  if (!playlistId) return { success: false, error: 'playlistId inválido' };
  return { success: true };
}

export async function unmarkPlaylistAsChallenge(playlistId: string): Promise<{ success: boolean; error?: string }> {
  // Feature desativada: não usar tabela challenge
  if (!playlistId) return { success: false, error: 'playlistId inválido' };
  return { success: true };
}

export async function isPlaylistChallenge(playlistId: string): Promise<boolean> {
  // Feature desativada: sempre não-desafio
  return false;
}
