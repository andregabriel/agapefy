// Text pacing utilities extracted from AIGenerator.tsx

export const normalizeSeconds = (value: string): string => {
  const normalized = (value || '').toString().trim().replace(',', '.');
  const match = normalized.match(/^[0-9]+(?:\.[0-9]+)?$/);
  if (!match) return '0.0';
  return normalized;
};

export const applyPacingBreaksToText = (input: string, commaTime: string, periodTime: string): string => {
  if (!input) return '';
  const comma = normalizeSeconds(commaTime);
  const period = normalizeSeconds(periodTime);
  let output = input;
  output = output.replace(/,(?!\s*<break\b)/g, `, <break time="${comma}s" />`);
  output = output.replace(/(^|[^0-9])\.(?![0-9]|\s*<break\b)/g, `$1. <break time="${period}s" />`);
  return output;
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};


