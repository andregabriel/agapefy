-- Função para deletar usuário por email
-- Uso: SELECT delete_user_by_email('email@exemplo.com');

CREATE OR REPLACE FUNCTION delete_user_by_email(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Buscar o ID do usuário pelo email
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id_to_delete IS NULL THEN
    RETURN 'Usuário com email ' || user_email || ' não encontrado';
  END IF;
  
  -- Deletar dados relacionados
  
  -- 1. Deletar sugestões do usuário
  DELETE FROM public.user_suggestions WHERE user_id = user_id_to_delete;
  
  -- 2. Deletar respostas de formulários
  DELETE FROM public.admin_form_responses WHERE user_id = user_id_to_delete;
  
  -- 3. Limpar user_id de whatsapp_users (SET NULL)
  UPDATE public.whatsapp_users SET user_id = NULL WHERE user_id = user_id_to_delete;
  
  -- 4. Limpar created_by de playlists (SET NULL)
  UPDATE public.playlists SET created_by = NULL WHERE created_by = user_id_to_delete;
  
  -- 5. Limpar created_by de challenge (SET NULL)
  UPDATE public.challenge SET created_by = NULL WHERE created_by = user_id_to_delete;
  
  -- 6. Limpar created_by de admin_forms (SET NULL)
  UPDATE public.admin_forms SET created_by = NULL WHERE created_by = user_id_to_delete;
  
  -- 7. Deletar bible_preferences (tem CASCADE, mas vamos garantir)
  DELETE FROM public.bible_preferences WHERE user_id = user_id_to_delete;
  
  -- 8. Deletar perfil
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  
  -- 9. Deletar de auth.users
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
  RETURN 'Usuário ' || user_email || ' deletado com sucesso! ID: ' || user_id_to_delete::TEXT;
END;
$$;

-- Executar a deleção do usuário andre@agapepray.com
SELECT delete_user_by_email('andre@agapepray.com');

