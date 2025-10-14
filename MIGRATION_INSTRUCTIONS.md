# 🚀 Instruções de Migração - Áudios para Storage

## ✅ O que foi implementado

### 1. Otimização de Performance (CRÍTICO - já ativo)
- ✅ Query `useUserActivity` otimizada - não puxa mais `audio_url`
- ✅ Redução de ~20MB → ~50KB de dados transferidos
- ✅ Home agora deve carregar em <3 segundos

### 2. APIs criadas
- ✅ `/api/upload-audio-to-storage` - Upload de base64 para Storage
- ✅ `/api/migrate-audios-to-storage` - Migração dos áudios existentes
- ✅ `/api/generate-audio` - Modificada para salvar no Storage

### 3. Novos áudios
- ✅ Admin/gerar-conteudo agora salva automaticamente no Supabase Storage
- ✅ Não salva mais base64 no banco

## 🔄 Migração dos 3 Áudios Existentes

### Passo 1: Iniciar o servidor
```bash
npm run dev
```

### Passo 2: Executar migração
```bash
curl -X POST http://localhost:3000/api/migrate-audios-to-storage \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
```

### Passo 3: Verificar resultado
A resposta mostrará:
```json
{
  "success": true,
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "id": "...",
      "title": "Nome do Áudio",
      "success": true,
      "old_url_preview": "data:audio/mpeg;base64,SUQzBAAAAA...",
      "new_url": "https://[seu-projeto].supabase.co/storage/v1/object/public/audios/migrated/..."
    }
  ]
}
```

### Passo 4: (Opcional) Remover API de migração
Após confirmar que funcionou, você pode deletar:
```bash
rm src/app/api/migrate-audios-to-storage/route.ts
```

## ✅ Validação

### 1. Teste a Home
- Acesse `/home`
- Deve carregar em <3 segundos
- "Orações Recentes" deve aparecer normalmente

### 2. Teste Player
- Clique em um áudio da home
- Deve tocar normalmente
- Funciona tanto para áudios migrados quanto base64 antigos

### 3. Teste Geração Nova
- Vá em `/admin/gerar-conteudo`
- Gere uma nova oração
- Áudio deve ser salvo no Storage automaticamente
- Verifique no console: deve mostrar URL do tipo `https://...supabase.co/storage/...`

## 🐛 Troubleshooting

### Erro: "Bucket 'audios' não existe"
Crie o bucket no Supabase:
1. Vá em Storage no dashboard Supabase
2. Crie bucket chamado `audios`
3. Marque como público
4. Execute migração novamente

### Erro: "SUPABASE_SERVICE_ROLE_KEY não configurada"
Adicione no arquivo `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

## 📊 Resultado Esperado

**Antes:**
- Home: 30 segundos
- 3 áudios com ~6MB de base64 no banco

**Depois:**
- Home: <3 segundos ✅
- 3 áudios com URLs do Storage ✅
- Novos áudios salvos no Storage ✅
- Total de dados transferidos: ~50KB vs ~20MB ✅

## 🗑️ Limpeza (Opcional)

Após validar que tudo funciona, você pode:
1. Remover `/api/migrate-audios-to-storage/route.ts`
2. Remover `/api/upload-audio-to-storage/route.ts` (se não for usar)
3. Remover este arquivo `MIGRATION_INSTRUCTIONS.md`

