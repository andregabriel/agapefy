import { supabase } from '@/lib/supabase';

// Detecta se a URL já é uma URL pública do Supabase Storage
export const isSupabasePublicUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.hostname.includes('.supabase.co') && u.pathname.includes('/storage/v1/object/public/');
  } catch {
    return false;
  }
};

export const uploadImageToSupabaseFromUrl = async (temporaryUrl: string): Promise<string> => {
  // Se já for uma URL pública do Supabase, retorna como está (evita reupload e duplicação)
  if (isSupabasePublicUrl(temporaryUrl)) {
    return temporaryUrl;
  }

  const response = await fetch('/api/image-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: temporaryUrl })
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const blob = await response.blob();

  let ext = 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
  if (contentType.includes('webp')) ext = 'webp';
  if (temporaryUrl.match(/\.jpe?g($|\?)/)) ext = 'jpg';
  if (temporaryUrl.match(/\.png($|\?)/)) ext = 'png';
  if (temporaryUrl.match(/\.webp($|\?)/)) ext = 'webp';

  const BUCKET = 'media';
  const PREFIX = 'app-26/images';
  const fileName = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  if (!publicData?.publicUrl) {
    throw new Error('Não foi possível obter URL pública da imagem');
  }

  return publicData.publicUrl;
};


