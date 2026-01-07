import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { upsertCategoryBannerLink } from '@/lib/supabase-queries';
import { isRecentesCategoryName } from '@/lib/utils';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Load current categories to find "Recentes" and compute desired position
    const { data: allCats, error: catsError } = await supabase
      .from('categories')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('order_position', { ascending: true });

    if (catsError) {
      return NextResponse.json({ ok: false, error: catsError.message }, { status: 400 });
    }

    const recentes = (allCats || []).find((c: any) => isRecentesCategoryName(c?.name));

    // Default new position after Recentes if found, else after first category, else 0
    const newPos = typeof recentes?.order_position === 'number'
      ? (recentes.order_position as number) + 1
      : ((allCats && allCats.length > 0) ? (((allCats[0] as any).order_position || 0) + 1) : 0);

    // Shift down categories at or after newPos to avoid duplicates
    const toShift = (allCats || []).filter((c: any) => typeof c.order_position === 'number' && c.order_position >= newPos);
    for (const cat of toShift) {
      await supabase
        .from('categories')
        .update({ order_position: (cat.order_position as number) + 1 })
        .eq('id', cat.id);
    }

    // Create category with banner layout
    const { data, error } = await supabase
      .from('categories')
      .insert([
        {
          name: 'Bíblicus: Conversa baseada na Bíblia',
          description: 'Converse sobre a Bíblia e obtenha respostas com base nas Escrituras',
          image_url: 'https://images.unsplash.com/photo-1591047139790-11b6c0f9af5f?q=80&w=1600&auto=format&fit=crop',
          layout_type: 'banner',
          is_featured: false,
          is_visible: true,
          order_position: newPos
        }
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    // Save banner link
    await upsertCategoryBannerLink(data.id, '/biblicus');

    return NextResponse.json({ ok: true, category: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro desconhecido' }, { status: 500 });
  }
}

