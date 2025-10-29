// Image prompt optimization extracted from AIGenerator.tsx

export const optimizeImagePrompt = (originalPrompt: string): string => {
  // Mantemos o prompt exatamente como definido pelo admin (apenas trim)
  // para que o texto enviado à OpenAI corresponda ao template de "Editar Prompt".
  return (originalPrompt || '').trim();
};


