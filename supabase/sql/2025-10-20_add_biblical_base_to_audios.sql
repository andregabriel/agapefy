-- Add biblical_base column to audios to store biblical references used in prayer
alter table if exists public.audios
add column if not exists biblical_base text;

comment on column public.audios.biblical_base is 'Referências bíblicas (ex: João 3:16; Salmo 23)';

