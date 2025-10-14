import { supabase } from '@/lib/supabase';

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
  duration: number | null;
  transcript: string | null;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
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
  created_by: string | null;
  is_public: boolean;
  created_at: string;
  category?: Category;
  audios?: Audio[];
  total_duration?: number;
  audio_count?: number;
}

// Buscar todas as categorias ordenadas com categoria fixa primeiro
export async function getCategories(): Promise<Category[]> {
  console.log('🔍 Buscando categorias com ordem: fixa primeiro, depois manual...');
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('is_featured', { ascending: false }) // Categoria fixa primeiro
    .order('order_position', { ascending: true }); // Depois ordem manual

  if (error) {
    console.error('❌ Erro ao buscar categorias:', error);
    return [];
  }

  console.log('✅ Categorias encontradas:', data?.length || 0);
  console.log('📋 Lista de categorias ordenadas:', data?.map(cat => ({ 
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
      console.error('Erro ao buscar links de banner:', error);
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
    console.error('Erro inesperado ao buscar links de banner:', err);
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

  return (data as Playlist[]) || [];
}

// Buscar áudios por categoria
export async function getAudiosByCategory(categoryId: string): Promise<Audio[]> {
  console.log('🎵 Buscando áudios da categoria:', categoryId);
  
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

  console.log('✅ Áudios encontrados na categoria:', data?.length || 0);
  return (data as Audio[]) || [];
}

// Buscar áudios (rápido, somente colunas necessárias para lista)
export async function getAudiosByCategoryFast(categoryId: string): Promise<Pick<Audio, 'id' | 'title' | 'subtitle' | 'duration' | 'category_id' | 'created_at' | 'cover_url'>[]> {
  const { data, error } = await supabase
    .from('audios')
    .select('id,title,subtitle,duration,category_id,created_at,cover_url')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar áudios (fast):', error);
    return [];
  }
  return (data as any[]) || [];
}

// Buscar áudios para várias categorias em uma única requisição (fast)
export async function getAudiosByCategoryBulkFast(categoryIds: string[]): Promise<Record<string, Pick<Audio, 'id' | 'title' | 'subtitle' | 'duration' | 'category_id' | 'created_at' | 'cover_url'>[]>> {
  if (!categoryIds.length) return {};

  const { data, error } = await supabase
    .from('audios')
    .select('id,title,subtitle,duration,category_id,created_at,cover_url')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar áudios em lote (fast):', error);
    return {};
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
  console.log('📋 Buscando playlists da categoria:', categoryId);
  
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('category_id', categoryId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists da categoria:', error);
    return [];
  }

  // Calcular duração e contagem para cada playlist
  const playlistsWithData = await Promise.all(
    (data || []).map(async (playlist: any) => {
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

  console.log('✅ Playlists encontradas na categoria:', playlistsWithData?.length || 0);
  return playlistsWithData as Playlist[];
}

// Buscar playlists públicas por categoria (rápido, sem estatísticas de duração/contagem)
export async function getPlaylistsByCategoryFast(categoryId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('id,title,description,category_id,created_at,is_public,cover_url')
    .eq('category_id', categoryId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists da categoria (fast):', error);
    return [];
  }

  return (data as Playlist[]) || [];
}

// Buscar playlists para várias categorias em uma única requisição (fast)
export async function getPlaylistsByCategoryBulkFast(categoryIds: string[]): Promise<Record<string, Playlist[]>> {
  if (!categoryIds.length) return {};

  const { data, error } = await supabase
    .from('playlists')
    .select('id,title,description,category_id,created_at,is_public,cover_url')
    .in('category_id', categoryIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar playlists em lote (fast):', error);
    return {};
  }

  const map: Record<string, Playlist[]> = {};
  ((data as any[]) || []).forEach((row) => {
    const cid = row.category_id as string | null;
    if (!cid) return;
    if (!map[cid]) map[cid] = [];
    map[cid].push(row as Playlist);
  });
  return map;
}

// Buscar áudios E playlists por categoria (função combinada)
export async function getCategoryContent(categoryId: string): Promise<{
  audios: Audio[];
  playlists: Playlist[];
}> {
  console.log('🔍 Buscando conteúdo completo da categoria:', categoryId);
  
  // Buscar áudios e playlists em paralelo
  const [audios, playlists] = await Promise.all([
    getAudiosByCategory(categoryId),
    getPlaylistsByCategory(categoryId)
  ]);

  console.log(`✅ Categoria ${categoryId}: ${audios.length} áudios + ${playlists.length} playlists`);
  
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
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao buscar playlists:', error);
    return [];
  }

  // Calcular duração e contagem para cada playlist
  const playlistsWithData = await Promise.all(
    (data || []).map(async (playlist: any) => {
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

  console.log(`🔍 Busca "${trimmedTerm}": ${audios.length} áudios, ${playlists.length} playlists, ${categories.length} categorias`);

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

  return {
    ...data,
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
  console.log('🔄 Forçando recarregamento das categorias...');
  return await getCategories();
}