## Local setup
- Install dependencies: `pnpm install`
- Start dev server: `pnpm dev`

## Manual test - profile edit visibility
Prereq: logged-in user with access to `/eu/config`.

1. Open `/eu/config`.
2. Expand "Perfil".
3. Click "Editar Perfil".
4. Verify the "Enviar foto" button is clearly visible on the dark background.
5. Click "Cancelar".
6. Confirm the edit mode closes and profile values remain unchanged.

## Optional manual test - upload flow
Requires valid Supabase storage access in the environment.

1. In edit mode, click "Enviar foto" and select an image.
2. Confirm the upload finishes and "Foto pronta para salvar" appears.
