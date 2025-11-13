import { supabase } from '@/lib/supabase';

export interface FormOption { label: string; category_id: string }
export interface AdminFormConfig { id: string; name: string; description?: string; schema: FormOption[] }

/**
 * Sanitiza um objeto removendo referências circulares e elementos DOM
 * para garantir que seja serializável em JSON
 */
function sanitizeForJSON(obj: any, visited = new WeakSet()): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Primitivos podem ser retornados diretamente
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Verificar se já visitamos este objeto (referência circular)
  if (visited.has(obj)) {
    return null; // Retornar null para referências circulares
  }
  
  // Adicionar à lista de visitados
  visited.add(obj);
  
  // Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJSON(item, visited));
  }
  
  // Verificar se é um elemento DOM ou objeto React
  if (typeof window !== 'undefined' && (
    obj instanceof HTMLElement || 
    obj instanceof Element || 
    obj instanceof Node ||
    obj instanceof Event ||
    obj instanceof EventTarget
  )) {
    return null; // Remover elementos DOM e eventos
  }
  
  // Verificar se tem propriedades React Fiber (indicando componente React)
  if (obj.$$typeof || obj._owner || obj.__reactFiber || obj.__reactInternalInstance) {
    return null; // Remover objetos React
  }
  
  // Verificar se é uma Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Objetos simples - criar uma cópia limpa
  const sanitized: Record<string, any> = {};
  for (const key in obj) {
    // Ignorar propriedades que podem causar referências circulares
    if (
      key.startsWith('__') || 
      key.startsWith('$') || 
      key === 'stateNode' || 
      key === 'return' || 
      key === 'child' ||
      key === 'parent' ||
      key === 'ownerDocument' ||
      key === 'parentNode' ||
      key === 'target' ||
      key === 'currentTarget'
    ) {
      continue;
    }
    
    try {
      const value = obj[key];
      // Verificar se é um tipo primitivo ou serializável
      if (typeof value === 'function') {
        continue; // Ignorar funções
      }
      sanitized[key] = sanitizeForJSON(value, visited);
    } catch (e) {
      // Se houver erro ao acessar a propriedade, ignorar
      continue;
    }
  }
  
  return sanitized;
}

export async function saveFormResponse(params: { formId: string; answers: Record<string, any>; userId?: string | null }) {
  const { formId, answers, userId } = params;
  
  // Sanitizar os dados antes de enviar para evitar erros de estrutura circular
  const sanitizedAnswers = sanitizeForJSON(answers);
  
  const { error } = await supabase
    .from('admin_form_responses')
    .insert({ form_id: formId, answers: sanitizedAnswers, user_id: userId ?? undefined });
  if (error) throw error;
  return { success: true };
}


