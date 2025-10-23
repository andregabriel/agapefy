import { supabase } from '@/lib/supabase';

export interface FormOption { label: string; category_id: string }
export interface AdminFormConfig { id: string; name: string; description?: string; schema: FormOption[] }

export async function saveFormResponse(params: { formId: string; answers: Record<string, any>; userId?: string | null }) {
  const { formId, answers, userId } = params;
  const { error } = await supabase
    .from('admin_form_responses')
    .insert({ form_id: formId, answers, user_id: userId ?? undefined });
  if (error) throw error;
  return { success: true };
}


