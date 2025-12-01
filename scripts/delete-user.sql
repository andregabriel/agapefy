-- Script para deletar usuário andre@agapepray.com e todos os dados relacionados
-- Execute este script no Supabase SQL Editor

DO $$
DECLARE
  user_id_to_delete UUID;
  user_email TEXT := 'andre@agapepray.com';
BEGIN
  -- Buscar o ID do usuário pelo email
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', user_email;
  END IF;
  
  RAISE NOTICE '✅ Encontrado usuário: % (ID: %)', user_email, user_id_to_delete;
  
  -- Deletar manualmente de tabelas que podem ter RLS bloqueando
  
  -- 1. Deletar sugestões do usuário (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_suggestions') THEN
    DELETE FROM public.user_suggestions WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ Sugestões deletadas';
  END IF;
  
  -- 2. Deletar respostas de formulários (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_form_responses') THEN
    DELETE FROM public.admin_form_responses WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ Respostas de formulários deletadas';
  END IF;
  
  -- 3. Limpar user_id de whatsapp_users (SET NULL) - se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_users') THEN
    UPDATE public.whatsapp_users SET user_id = NULL WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ WhatsApp users atualizados';
  END IF;
  
  -- 4. Limpar created_by de playlists - IMPORTANTE: fazer antes de deletar perfil
  -- Primeiro tentar setar NULL, se falhar transferir para um admin
  DECLARE
    admin_user_id UUID;
    playlist_count INTEGER;
  BEGIN
    -- Verificar quantas playlists existem
    SELECT COUNT(*) INTO playlist_count
    FROM public.playlists
    WHERE created_by = user_id_to_delete;
    
    IF playlist_count > 0 THEN
      RAISE NOTICE 'ℹ️ Encontradas % playlist(s) do usuário', playlist_count;
      
      -- Tentar setar NULL primeiro
      BEGIN
        UPDATE public.playlists SET created_by = NULL WHERE created_by = user_id_to_delete;
        RAISE NOTICE '✅ Playlists atualizadas (created_by = NULL)';
      EXCEPTION
        WHEN OTHERS THEN
          -- Se não conseguir setar NULL (constraint não permite), transferir para um admin
          RAISE NOTICE '⚠️ Não foi possível setar NULL. Transferindo para um admin...';
          
          -- Buscar um usuário admin para transferir a propriedade
          SELECT id INTO admin_user_id
          FROM public.profiles
          WHERE role = 'admin'
          LIMIT 1;
          
          IF admin_user_id IS NOT NULL THEN
            UPDATE public.playlists 
            SET created_by = admin_user_id 
            WHERE created_by = user_id_to_delete;
            RAISE NOTICE '✅ Playlists transferidas para admin (ID: %)', admin_user_id;
          ELSE
            -- Se não houver admin, criar um usuário sistema ou usar o primeiro usuário disponível
            -- Por segurança, vamos apenas avisar e tentar continuar
            RAISE WARNING '⚠️ Não foi possível transferir playlists. Tentando continuar mesmo assim...';
            RAISE WARNING '⚠️ Pode ser necessário ajustar manualmente as playlists depois.';
          END IF;
      END;
    ELSE
      RAISE NOTICE 'ℹ️ Nenhuma playlist encontrada para este usuário';
    END IF;
  END;
  
  -- 5. Limpar created_by de challenge (SET NULL) - apenas se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'challenge') THEN
    UPDATE public.challenge SET created_by = NULL WHERE created_by = user_id_to_delete;
    RAISE NOTICE '✅ Challenge atualizado (created_by limpo)';
  ELSE
    RAISE NOTICE 'ℹ️ Tabela challenge não existe, pulando...';
  END IF;
  
  -- 6. Limpar created_by de admin_forms (SET NULL) - apenas se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_forms') THEN
    UPDATE public.admin_forms SET created_by = NULL WHERE created_by = user_id_to_delete;
    RAISE NOTICE '✅ Admin forms atualizados (created_by limpo)';
  ELSE
    RAISE NOTICE 'ℹ️ Tabela admin_forms não existe, pulando...';
  END IF;
  
  -- 7. Deletar bible_preferences (tem CASCADE, mas vamos garantir) - se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bible_preferences') THEN
    DELETE FROM public.bible_preferences WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ Bible preferences deletadas';
  END IF;
  
  -- 8. Deletar perfil (agora que todas as referências foram limpas)
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  RAISE NOTICE '✅ Perfil deletado';
  
  -- 9. Deletar de auth.users (isso vai acionar os CASCADE automaticamente)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  RAISE NOTICE '✅ Usuário deletado de auth.users';
  
  RAISE NOTICE '🎉 Usuário % deletado com sucesso!', user_email;
END $$;

