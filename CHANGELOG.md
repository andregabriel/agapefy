# Changelog do Projeto

## [Atual] - 2025-01-17

### Adicionado
- Sistema modular para AIGenerator
- Upload automático de imagens para Supabase Storage
- Hooks customizados para duração de áudio e debug logs

### Corrigido
- Salvamento da cover_url no banco de dados
- Erro de sintaxe JSX no AIGenerator
- URLs temporárias do DALL-E agora são salvas no Supabase

### Componentes principais
- `src/components/admin/AIGenerator.tsx` - Componente principal refatorado
- `src/lib/image-upload.ts` - Utilitário para upload de imagens
- `src/hooks/useAudioDuration.ts` - Hook para duração de áudio
- `src/hooks/useDebugLogs.ts` - Hook para logs de debug

## Instruções para restaurar versão
Se precisar voltar a uma versão anterior:
1. Copie o código dos arquivos desta versão
2. Use lasy-write para recriar os arquivos
3. Teste a funcionalidade

---
**Nota**: Este arquivo serve como backup manual enquanto o sistema de versões da plataforma está com problemas.