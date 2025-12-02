-- Adiciona suporte a múltiplas categorias por playlist
alter table public.playlists
  add column if not exists category_ids uuid[] default '{}'::uuid[];

-- Preenche o array com a categoria principal existente (se ainda não estiver presente)
update public.playlists
set category_ids = array_remove(array_append(coalesce(category_ids, '{}'::uuid[]), category_id), null)
where category_id is not null
  and (category_ids is null or not category_id = any(category_ids));

-- Índice para buscas por categoria usando o array
create index if not exists idx_playlists_category_ids on public.playlists using gin (category_ids);
