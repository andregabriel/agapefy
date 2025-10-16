import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

// Normaliza strings removendo acentos e caixa para comparações robustas
export function normalizeText(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Identifica a categoria "Recentes" mesmo que seja salva como "Orações Recentes"
export function isRecentesCategoryName(name?: string | null): boolean {
  const normalized = normalizeText(name);
  return normalized === 'recentes' || normalized === 'oracoes recentes';
}

// Identifica a categoria "Rotina" mesmo que seja salva como "Minha Rotina"
export function isRotinaCategoryName(name?: string | null): boolean {
  const normalized = normalizeText(name);
  return normalized === 'rotina' || normalized === 'minha rotina';
}