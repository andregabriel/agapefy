// Image prompt optimization extracted from AIGenerator.tsx

export const optimizeImagePrompt = (originalPrompt: string): string => {
  let optimizedPrompt = originalPrompt
    .replace(/^(gere a imagem de|crie uma imagem de|faça uma imagem de)/i, '')
    .trim();

  const prefix = 'Religious Christian scene:';
  const suffix = 'photorealistic, soft warm lighting, peaceful atmosphere, high quality, inspirational, beautiful composition';
  return `${prefix} ${optimizedPrompt}, ${suffix}`;
};


