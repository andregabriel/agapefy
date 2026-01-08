# DB Schema Quick Map

Objetivo: onboarding rapido para LLMs. Este mapa e derivado de referencias no codigo (Supabase queries) e migrations em `supabase/sql`. Sempre valide no schema do Supabase.

## Tabelas (agrupadas)

### Core / identidade
- `auth.users` (Supabase Auth)
- `profiles`

### Conteudo
- `categories`
- `audios`
- `playlists`
- `playlist_audios`
- `images`
- `media`
- `phrases`
- `verses`
- `legal_documents`

### Usuario (preferencias, progresso, logs)
- `user_activity_log`
- `user_favorites`
- `user_downloads`
- `user_goals`
- `user_prayer_dates`
- `user_intentions`
- `user_reflections`
- `user_feedback`
- `user_suggestions`
- `bible_preferences`
- `notifications`

### Comunidade
- `posts`
- `post_comments`
- `post_likes`
- `post_intercessions`
- `user_follows`
- `conversations`
- `messages`

### Onboarding / admin / settings
- `admin_forms`
- `admin_form_responses`
- `app_settings`
- `free_play_limits`

### WhatsApp
- `whatsapp_users`
- `whatsapp_conversations`
- `whatsapp_user_challenges`
- `whatsapp_challenge_log`
- `whatsapp_prayer_log`
- `daily_verse_log`
- `challenge`

### Assinaturas
- `assinaturas`

## Relacionamentos (mais comuns)
- `profiles.id` -> `auth.users.id` (1:1)
- `audios.category_id` -> `categories.id`
- `playlist_audios.playlist_id` -> `playlists.id`
- `playlist_audios.audio_id` -> `audios.id`
- `user_favorites.user_id` -> `profiles.id`
- `user_favorites.audio_id` -> `audios.id`
- `user_downloads.user_id` -> `profiles.id`
- `user_downloads.audio_id` -> `audios.id`
- `user_activity_log.user_id` -> `profiles.id`
- `user_activity_log.audio_id` -> `audios.id`
- `user_goals.user_id` -> `profiles.id`
- `user_prayer_dates.user_id` -> `profiles.id`
- `user_intentions.user_id` -> `profiles.id`
- `user_reflections.user_id` -> `profiles.id`
- `user_feedback.user_id` -> `profiles.id`
- `user_suggestions.user_id` -> `profiles.id`
- `bible_preferences.user_id` -> `profiles.id`
- `notifications.user_id` -> `profiles.id`
- `posts.user_id` -> `profiles.id`
- `post_comments.post_id` -> `posts.id`
- `post_comments.user_id` -> `profiles.id`
- `post_likes.post_id` -> `posts.id`
- `post_likes.user_id` -> `profiles.id`
- `post_intercessions.post_id` -> `posts.id`
- `post_intercessions.user_id` -> `profiles.id`
- `user_follows.follower_id` -> `profiles.id`
- `user_follows.following_id` -> `profiles.id`
- `messages.conversation_id` -> `conversations.id`
- `messages.user_id` -> `profiles.id` (quando mensagem e do usuario)
- `admin_form_responses.form_id` -> `admin_forms.id`
- `admin_form_responses.user_id` -> `profiles.id`
- `free_play_limits.user_id` -> `profiles.id`
- `whatsapp_users.user_id` -> `profiles.id` (opcional)
- `whatsapp_conversations.phone_number` -> `whatsapp_users.phone_number` (ou whatsapp_user_id)
- `whatsapp_user_challenges.phone_number` -> `whatsapp_users.phone_number`
- `whatsapp_user_challenges.playlist_id` -> `playlists.id`
- `whatsapp_challenge_log.phone_number` -> `whatsapp_users.phone_number`
- `whatsapp_challenge_log.playlist_id` -> `playlists.id`
- `whatsapp_prayer_log.phone_number` -> `whatsapp_users.phone_number`
- `daily_verse_log.phone_number` -> `whatsapp_users.phone_number`

## Notas
- Nem todos os relacionamentos sao FK formais; alguns sao chaves logicas.
- Para detalhes de colunas e constraints, conferir o schema no Supabase.
