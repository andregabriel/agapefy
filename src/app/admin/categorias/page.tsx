"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Music, 
  List,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  Settings,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getCategories, 
  getCategoryContent,
  getPlaylistsByCategory,
  getCategoryBannerLinks,
  upsertCategoryBannerLink,
  type Category, 
  type Audio, 
  type Playlist 
} from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserActivity } from '@/hooks/useUserActivity';
import { isRecentesCategoryName } from '@/lib/utils';

interface CategoryWithContent extends Category {
  audios: Audio[];
  playlists: Playlist[];
}

export default function AdminCategoriasPage() {
  const { user } = useAuth();
  const { settings, updateSetting, loading: settingsLoading } = useAppSettings();
  const { activities, loading: activitiesLoading } = useUserActivity();
  const [categories, setCategories] = useState<CategoryWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithContent | null>(null);
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  
  // Estados para formulários
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    description: '',
    image_url: '',
    layout_type: 'spotify',
    is_featured: false,
    is_visible: true,
    banner_link: '' as string
  });
  
  const [newPlaylistForm, setNewPlaylistForm] = useState({
    title: '',
    description: '',
    cover_url: '',
    is_public: true
  });
  
  // Estados para configurações
  const [quoteSettings, setQuoteSettings] = useState({
    prayer_quote_text: '',
    prayer_quote_reference: ''
  });
  
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBannerLink, setEditingBannerLink] = useState<string>('');
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [showNewPlaylistDialog, setShowNewPlaylistDialog] = useState(false);
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [bannerLinks, setBannerLinks] = useState<Record<string, string>>({});

  // Persistência do modal de Nova Categoria
  const NEW_CAT_OPEN_KEY = 'admin.categories.new.open';
  const NEW_CAT_FORM_KEY = 'admin.categories.new.form';

  // Restaurar estado salvo do modal e do formulário ao montar
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const openRaw = localStorage.getItem(NEW_CAT_OPEN_KEY);
      const formRaw = localStorage.getItem(NEW_CAT_FORM_KEY);
      const open = openRaw ? JSON.parse(openRaw) : false;
      if (open) setShowNewCategoryDialog(true);
      if (formRaw) {
        const parsed = JSON.parse(formRaw);
        setNewCategoryForm(prev => ({ ...prev, ...parsed }));
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // Salvar estado de abertura do modal
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(NEW_CAT_OPEN_KEY, JSON.stringify(showNewCategoryDialog));
      if (!showNewCategoryDialog) {
        // Ao fechar, não precisamos manter o formulário
        localStorage.removeItem(NEW_CAT_FORM_KEY);
      }
    } catch (_) {
      // ignore
    }
  }, [showNewCategoryDialog]);

  // Salvar alterações do formulário enquanto o modal estiver aberto
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!showNewCategoryDialog) return;
      localStorage.setItem(NEW_CAT_FORM_KEY, JSON.stringify(newCategoryForm));
    } catch (_) {
      // ignore
    }
  }, [newCategoryForm, showNewCategoryDialog]);

  // Sincronizar configurações quando carregarem
  useEffect(() => {
    if (!settingsLoading) {
      setQuoteSettings({
        prayer_quote_text: settings.prayer_quote_text,
        prayer_quote_reference: settings.prayer_quote_reference
      });
    }
  }, [settings, settingsLoading]);

  // Carregar categorias
  const loadCategories = async () => {
    try {
      setLoading(true);
      const categoriesData = await getCategories();
      
      // Carregar conteúdo para cada categoria
      const categoriesWithContent = await Promise.all(
        categoriesData.map(async (category) => {
          if (isRecentesCategoryName(category.name)) {
            const activityAudios = (activities || []).map((a: any) => a.audio);
            const recentPlaylists = await getPlaylistsByCategory(category.id);
            return { ...category, audios: activityAudios, playlists: recentPlaylists } as any;
          }

          const { audios, playlists } = await getCategoryContent(category.id);
          return {
            ...category,
            audios: audios || [],
            playlists: playlists || []
          };
        })
      );
      
      setCategories(categoriesWithContent);
      console.log('✅ Categorias carregadas:', categoriesWithContent.length);
    } catch (error) {
      console.error('❌ Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // Carregar links de banner para edição e consistência visual
    (async () => {
      try {
        const map = await getCategoryBannerLinks();
        setBannerLinks(map);
      } catch (e) {
        console.warn('Não foi possível carregar links de banner:', e);
      }
    })();
  }, []);

  // Atualizar conteúdo da categoria "Recentes" quando atividades mudarem
  useEffect(() => {
    if (!activitiesLoading) {
      loadCategories();
    }
  }, [activitiesLoading]);

  // Upload helper: envia imagem ao Supabase e retorna URL pública
  const uploadImageToSupabase = async (file: File): Promise<string> => {
    const BUCKET = 'media';
    const PREFIX = 'app-26/images/categories';
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const fileName = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/png',
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    if (!publicData?.publicUrl) throw new Error('Falha ao obter URL pública');
    return publicData.publicUrl;
  };

  const handleNewImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingNewImage(true);
      const url = await uploadImageToSupabase(file);
      setNewCategoryForm(prev => ({ ...prev, image_url: url }));
      toast.success('Imagem enviada!');
    } catch (err) {
      console.error('❌ Erro no upload de imagem (nova categoria):', err);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingNewImage(false);
      if (newImageInputRef.current) newImageInputRef.current.value = '';
    }
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCategory) return;
    try {
      setUploadingEditImage(true);
      const url = await uploadImageToSupabase(file);
      setEditingCategory(prev => (prev ? { ...prev, image_url: url } : prev));
      toast.success('Imagem enviada!');
    } catch (err) {
      console.error('❌ Erro no upload de imagem (editar categoria):', err);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingEditImage(false);
      if (editImageInputRef.current) editImageInputRef.current.value = '';
    }
  };

  // Salvar configurações da frase bíblica
  const handleSaveQuoteSettings = async () => {
    try {
      const textResult = await updateSetting('prayer_quote_text', quoteSettings.prayer_quote_text);
      const refResult = await updateSetting('prayer_quote_reference', quoteSettings.prayer_quote_reference);
      
      if (textResult.success && refResult.success) {
        toast.success('Configurações salvas com sucesso!');
        setShowSettingsDialog(false);
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  // Criar nova categoria
  const handleCreateCategory = async () => {
    try {
      // Validações específicas para layout banner
      if (newCategoryForm.layout_type === 'banner') {
        if (!newCategoryForm.image_url?.trim()) {
          toast.error('Para layout Banner, envie a imagem.');
          return;
        }
        if (!newCategoryForm.banner_link?.trim()) {
          toast.error('Para layout Banner, informe o Link do Banner.');
          return;
        }
      }

      // Montar payload apenas com colunas válidas da tabela categories
      const payload = {
        name: newCategoryForm.name.trim(),
        description: newCategoryForm.description?.trim() || null,
        image_url: newCategoryForm.image_url?.trim() || null,
        layout_type: newCategoryForm.layout_type,
        is_featured: !!newCategoryForm.is_featured,
        is_visible: newCategoryForm.is_visible !== false,
        order_position: categories.length,
      } as const;

      if (!payload.name) {
        toast.error('Informe o nome da categoria.');
        return;
      }

      // Verificar duplicidade de nome (feedback amigável antes do insert)
      const { data: existing, error: existingError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', payload.name)
        .maybeSingle();

      if (!existingError && existing?.id) {
        toast.error('Já existe uma categoria com este nome.');
        return;
      }

      let { data, error } = await supabase
        .from('categories')
        .insert([payload])
        .select()
        .single();

      if (error) {
        const msg = (error as any)?.message || '';
        console.error('Supabase insert error (categories):', error);
        // Fallback: alguns bancos locais podem não aceitar "banner" ainda
        if (payload.layout_type === 'banner' && msg.includes('categories_layout_type_check')) {
          const fallbackPayload = { ...payload, layout_type: 'full' as const };
          const retry = await supabase
            .from('categories')
            .insert([fallbackPayload])
            .select()
            .single();
          error = (retry as any).error;
          data = (retry as any).data;
          if (error) {
            console.error('Retry insert error (fallback full):', error);
            throw error;
          }
        } else {
          throw error;
        }
      }

      if (newCategoryForm.layout_type === 'banner' && data?.id && newCategoryForm.banner_link?.trim()) {
        await upsertCategoryBannerLink(data.id, newCategoryForm.banner_link.trim());
      }

      toast.success('Categoria criada com sucesso!');
      setNewCategoryForm({
        name: '',
        description: '',
        image_url: '',
        layout_type: 'spotify',
        is_featured: false,
        is_visible: true,
        banner_link: ''
      });
      setShowNewCategoryDialog(false);
      // Limpar persistência após criar com sucesso
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(NEW_CAT_FORM_KEY);
          localStorage.removeItem(NEW_CAT_OPEN_KEY);
        }
      } catch (_) {
        // ignore
      }
      loadCategories();
    } catch (error: any) {
      // Log gentil mas informativo
      const message = error?.message || (typeof error === 'string' ? error : 'Erro desconhecido');
      console.error('❌ Erro ao criar categoria (detalhes):', message, error);
      toast.error(message);
    }
  };

  // Atualizar categoria
  const handleUpdateCategory = async (category: Category, updates: Partial<Category>) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', category.id);

      if (error) throw error;

      toast.success('Categoria atualizada!');
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao atualizar categoria:', error);
      toast.error('Erro ao atualizar categoria');
    }
  };

  // Editar categoria
  const handleEditCategory = async () => {
    if (!editingCategory) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editingCategory.name,
          description: editingCategory.description,
          image_url: editingCategory.image_url,
          layout_type: editingCategory.layout_type,
          is_featured: editingCategory.is_featured,
          is_visible: (editingCategory as any).is_visible ?? true
        })
        .eq('id', editingCategory.id);

      if (error) throw error;

      if (editingCategory.layout_type === 'banner' && editingCategory.id) {
        await upsertCategoryBannerLink(editingCategory.id, editingBannerLink || '');
      }

      toast.success('Categoria atualizada com sucesso!');
      setShowEditCategoryDialog(false);
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao atualizar categoria:', error);
      toast.error('Erro ao atualizar categoria');
    }
  };

  // Deletar categoria
  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta categoria?')) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast.success('Categoria deletada!');
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao deletar categoria:', error);
      toast.error('Erro ao deletar categoria');
    }
  };

  // Criar nova playlist
  const handleCreatePlaylist = async () => {
    if (!selectedCategory) return;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert([{
          ...newPlaylistForm,
          category_id: selectedCategory.id,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Playlist criada com sucesso!');
      setNewPlaylistForm({
        title: '',
        description: '',
        cover_url: '',
        is_public: true
      });
      setShowNewPlaylistDialog(false);
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao criar playlist:', error);
      toast.error('Erro ao criar playlist');
    }
  };

  // Atualizar playlist
  const handleUpdatePlaylist = async (playlist: Playlist, updates: Partial<Playlist>) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update(updates)
        .eq('id', playlist.id);

      if (error) throw error;

      toast.success('Playlist atualizada!');
      setEditingPlaylist(null);
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao atualizar playlist:', error);
      toast.error('Erro ao atualizar playlist');
    }
  };

  // Deletar playlist
  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta playlist?')) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;

      toast.success('Playlist deletada!');
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao deletar playlist:', error);
      toast.error('Erro ao deletar playlist');
    }
  };

  // Mover categoria para cima/baixo
  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex(cat => cat.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    try {
      // Trocar posições
      const updates = [
        { id: categories[currentIndex].id, order_position: newIndex },
        { id: categories[newIndex].id, order_position: currentIndex }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('categories')
          .update({ order_position: update.order_position })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast.success('Ordem atualizada!');
      loadCategories();
    } catch (error) {
      console.error('❌ Erro ao mover categoria:', error);
      toast.error('Erro ao mover categoria');
    }
  };

  // Abrir modal de edição
  const handleOpenEditCategory = (category: CategoryWithContent) => {
    console.log('✏️ Abrindo edição da categoria:', category.name);
    setEditingCategory({
      id: category.id,
      name: category.name,
      description: category.description || '',
      image_url: category.image_url || '',
      layout_type: category.layout_type || 'spotify',
      is_featured: category.is_featured || false,
      created_at: category.created_at,
      order_position: category.order_position,
      is_visible: (category as any).is_visible ?? true
    });
    // Prefill com link existente, se houver
    setEditingBannerLink(bannerLinks[category.id] || '');
    setShowEditCategoryDialog(true);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando categorias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Categorias</h1>
          <p className="text-gray-600 mt-2">Organize orações e playlists por categorias</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Botão de configurações */}
          <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings size={16} className="mr-2" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-gray-900">
                  <Heart className="text-blue-600" size={20} />
                  <span>Frase Bíblica</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="quote-text" className="text-gray-700 font-medium">Texto da Frase</Label>
                  <Textarea
                    id="quote-text"
                    value={quoteSettings.prayer_quote_text}
                    onChange={(e) => setQuoteSettings(prev => ({ ...prev, prayer_quote_text: e.target.value }))}
                    placeholder="Digite a frase bíblica..."
                    rows={3}
                    className="text-gray-900 bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="quote-reference" className="text-gray-700 font-medium">Referência Bíblica</Label>
                  <Input
                    id="quote-reference"
                    value={quoteSettings.prayer_quote_reference}
                    onChange={(e) => setQuoteSettings(prev => ({ ...prev, prayer_quote_reference: e.target.value }))}
                    placeholder="Ex: Mateus 18:20"
                    className="text-gray-900 bg-white border-gray-300"
                  />
                </div>
                
                {/* Preview */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
                  <p className="text-sm text-gray-500 mb-2">Preview:</p>
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Heart className="text-blue-600" size={16} />
                    </div>
                    <p className="text-gray-700 font-medium text-sm mb-1 italic">
                      {quoteSettings.prayer_quote_text || 'Texto da frase...'}
                    </p>
                    <p className="text-blue-600 font-semibold text-xs">
                      {quoteSettings.prayer_quote_reference || 'Referência...'}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={handleSaveQuoteSettings} className="flex-1">
                    <Save size={16} className="mr-2" />
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Botão nova categoria */}
          <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} className="mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-gray-900">Criar Nova Categoria</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-gray-700 font-medium">Nome</Label>
                  <Input
                    id="name"
                    value={newCategoryForm.name}
                    onChange={(e) => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome da categoria"
                    className="text-gray-900 bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newCategoryForm.description}
                    onChange={(e) => setNewCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição da categoria"
                    className="text-gray-900 bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="image_url" className="text-gray-700 font-medium">URL da Imagem</Label>
                  <div className="flex gap-2">
                    <Input
                      id="image_url"
                      value={newCategoryForm.image_url}
                      onChange={(e) => setNewCategoryForm(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="text-gray-900 bg-white border-gray-300 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => newImageInputRef.current?.click()}
                      disabled={uploadingNewImage}
                      title="Fazer upload para o Supabase"
                    >
                      <Upload size={16} />
                      {uploadingNewImage ? 'Enviando...' : 'Upload'}
                    </Button>
                    <input
                      ref={newImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleNewImageFileChange}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="layout_type" className="text-gray-700 font-medium">Tipo de Layout</Label>
                  <Select
                    value={newCategoryForm.layout_type}
                    onValueChange={(value) => setNewCategoryForm(prev => ({ ...prev, layout_type: value }))}
                  >
                    <SelectTrigger className="text-gray-900 bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spotify">Spotify (Padrão)</SelectItem>
                      <SelectItem value="grid_3_rows">Grid 3 Linhas</SelectItem>
                      <SelectItem value="double_height">Altura Dobrada</SelectItem>
                      <SelectItem value="full">Full Width</SelectItem>
                      <SelectItem value="banner">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newCategoryForm.layout_type === 'banner' && (
                  <div>
                    <Label htmlFor="banner_link" className="text-gray-700 font-medium">Link do Banner</Label>
                    <Input
                      id="banner_link"
                      value={newCategoryForm.banner_link}
                      onChange={(e) => setNewCategoryForm(prev => ({ ...prev, banner_link: e.target.value }))}
                      placeholder="/biblicus ou https://exemplo.com/algum-lugar"
                      className="text-gray-900 bg-white border-gray-300"
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={newCategoryForm.is_featured}
                    onChange={(e) => setNewCategoryForm(prev => ({ ...prev, is_featured: e.target.checked }))}
                  />
                  <Label htmlFor="is_featured" className="text-gray-700">Categoria em destaque</Label>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleCreateCategory} className="flex-1">
                    <Save size={16} className="mr-2" />
                    Criar Categoria
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewCategoryDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {(() => {
          const current = Number.parseInt(settings.prayer_quote_position || '0', 10);
          const quotePos = Number.isFinite(current)
            ? Math.max(0, Math.min(categories.length, current))
            : 0;

          const QuoteCard = () => (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="text-blue-600" size={18} />
                    <span>Frase Bíblica</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPos = Math.max(0, quotePos - 1);
                        await updateSetting('prayer_quote_position', String(newPos));
                        toast.success('Posição atualizada!');
                      }}
                      disabled={quotePos <= 0}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPos = Math.min(categories.length, quotePos + 1);
                        await updateSetting('prayer_quote_position', String(newPos));
                        toast.success('Posição atualizada!');
                      }}
                      disabled={quotePos >= categories.length}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettingsDialog(true)}
                      title="Configurações da Frase Bíblica"
                    >
                      <Settings size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );

          return (
            <>
              {categories.map((category, index) => (
                <React.Fragment key={`cat-${category.id}`}>
                  {index === quotePos && <QuoteCard />}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{isRecentesCategoryName(category.name) ? 'Orações Recentes' : category.name}</span>
                              {category.is_featured && (
                                <Badge variant="secondary">Destaque</Badge>
                              )}
                              <Badge variant="outline">{category.layout_type}</Badge>
                            </CardTitle>
                            <p className="text-gray-600 mt-1">{category.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveCategory(category.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveCategory(category.id, 'down')}
                            disabled={index === categories.length - 1}
                          >
                            <ArrowDown size={16} />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCategory(category);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Editar categoria"
                            data-testid={`edit-cat-${category.id}`}
                          >
                            <Edit size={16} />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <Tabs defaultValue="audios" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="audios" className="flex items-center space-x-2">
                            <Music size={16} />
                            <span>Orações ({category.audios.length})</span>
                          </TabsTrigger>
                          <TabsTrigger value="playlists" className="flex items-center space-x-2">
                            <List size={16} />
                            <span>Playlists ({category.playlists.length})</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Tab de Orações/Áudios */}
                        <TabsContent value="audios" className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Orações da Categoria</h3>
                            <Button size="sm" variant="outline">
                              <Plus size={16} className="mr-2" />
                              Adicionar Oração
                            </Button>
                          </div>
                          
                          {category.audios.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Music size={48} className="mx-auto mb-4 opacity-50" />
                              <p>Nenhuma oração nesta categoria</p>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              {category.audios.map((audio, idx) => (
                                <div key={`${category.id}-${audio.id}-${idx}`} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <h4 className="font-medium">{audio.title}</h4>
                                    {audio.subtitle && (
                                      <p className="text-sm text-gray-600">{audio.subtitle}</p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      {audio.duration ? `${Math.round(audio.duration / 60)} min` : 'Duração não definida'}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Button size="sm" variant="outline">
                                      <Edit size={16} />
                                    </Button>
                                    <Button size="sm" variant="outline">
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                        
                        {/* Tab de Playlists */}
                        <TabsContent value="playlists" className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Playlists da Categoria</h3>
                            <Dialog open={showNewPlaylistDialog} onOpenChange={setShowNewPlaylistDialog}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedCategory(category)}
                                >
                                  <Plus size={16} className="mr-2" />
                                  Nova Playlist
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="text-gray-900">Criar Nova Playlist</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="playlist-title" className="text-gray-700 font-medium">Título</Label>
                                    <Input
                                      id="playlist-title"
                                      value={newPlaylistForm.title}
                                      onChange={(e) => setNewPlaylistForm(prev => ({ ...prev, title: e.target.value }))}
                                      placeholder="Título da playlist"
                                      className="text-gray-900 bg-white border-gray-300"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="playlist-description" className="text-gray-700 font-medium">Descrição</Label>
                                    <Textarea
                                      id="playlist-description"
                                      value={newPlaylistForm.description}
                                      onChange={(e) => setNewPlaylistForm(prev => ({ ...prev, description: e.target.value }))}
                                      placeholder="Descrição da playlist"
                                      className="text-gray-900 bg-white border-gray-300"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="playlist-cover" className="text-gray-700 font-medium">URL da Capa</Label>
                                    <Input
                                      id="playlist-cover"
                                      value={newPlaylistForm.cover_url}
                                      onChange={(e) => setNewPlaylistForm(prev => ({ ...prev, cover_url: e.target.value }))}
                                      placeholder="https://exemplo.com/capa.jpg"
                                      className="text-gray-900 bg-white border-gray-300"
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="playlist-public"
                                      checked={newPlaylistForm.is_public}
                                      onChange={(e) => setNewPlaylistForm(prev => ({ ...prev, is_public: e.target.checked }))}
                                    />
                                    <Label htmlFor="playlist-public" className="text-gray-700">Playlist pública</Label>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button onClick={handleCreatePlaylist} className="flex-1">
                                      <Save size={16} className="mr-2" />
                                      Criar Playlist
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowNewPlaylistDialog(false)}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                          
                          {category.playlists.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <List size={48} className="mx-auto mb-4 opacity-50" />
                              <p>Nenhuma playlist nesta categoria</p>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              {category.playlists.map((playlist) => (
                                <div key={playlist.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <h4 className="font-medium">{playlist.title}</h4>
                                    {playlist.description && (
                                      <p className="text-sm text-gray-600">{playlist.description}</p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      {playlist.audio_count ? `${playlist.audio_count} áudios` : 'Sem contagem'}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditPlaylist(playlist)}>
                                      <Edit size={16} />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleDeletePlaylist(playlist.id)}>
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </React.Fragment>
              ))}
              {quotePos >= categories.length && <QuoteCard />}
            </>
          );
        })()}
      </div>

      {/* Dialog para editar categoria */}
      {showEditCategoryDialog && editingCategory && (
        <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-gray-900">Editar Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="text-gray-700 font-medium">Nome</Label>
                <Input
                  id="edit-name"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Nome da categoria"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="edit-description" className="text-gray-700 font-medium">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Descrição da categoria"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="edit-image_url" className="text-gray-700 font-medium">URL da Imagem</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-image_url"
                    value={editingCategory.image_url}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, image_url: e.target.value } : null)}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="text-gray-900 bg-white border-gray-300 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editImageInputRef.current?.click()}
                    disabled={uploadingEditImage}
                    title="Fazer upload para o Supabase"
                  >
                    <Upload size={16} />
                    {uploadingEditImage ? 'Enviando...' : 'Upload'}
                  </Button>
                  <input
                    ref={editImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditImageFileChange}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-layout_type" className="text-gray-700 font-medium">Tipo de Layout</Label>
                <Select
                  value={editingCategory.layout_type}
                  onValueChange={(value) => setEditingCategory(prev => prev ? { ...prev, layout_type: value } : null)}
                >
                  <SelectTrigger className="text-gray-900 bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spotify">Spotify (Padrão)</SelectItem>
                    <SelectItem value="grid_3_rows">Grid 3 Linhas</SelectItem>
                    <SelectItem value="double_height">Altura Dobrada</SelectItem>
                    <SelectItem value="full">Full Width</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingCategory.layout_type === 'banner' && (
                <div>
                  <Label htmlFor="edit-banner-link" className="text-gray-700 font-medium">Link do Banner</Label>
                  <Input
                    id="edit-banner-link"
                    value={editingBannerLink}
                    onChange={(e) => setEditingBannerLink(e.target.value)}
                    placeholder="/biblicus ou https://exemplo.com/algum-lugar"
                    className="text-gray-900 bg-white border-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">Usuários serão redirecionados ao clicar na imagem do banner.</p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_featured"
                  checked={editingCategory.is_featured}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, is_featured: e.target.checked } : null)}
                />
                <Label htmlFor="edit-is_featured" className="text-gray-700">Categoria em destaque</Label>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleEditCategory} className="flex-1">
                  <Save size={16} className="mr-2" />
                  Salvar Alterações
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowEditCategoryDialog(false);
                  setEditingCategory(null);
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para editar playlist */}
      {editingPlaylist && (
        <Dialog open={!!editingPlaylist} onOpenChange={() => setEditingPlaylist(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-gray-900">Editar Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title" className="text-gray-700 font-medium">Título</Label>
                <Input
                  id="edit-title"
                  value={editingPlaylist.title}
                  onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="Título da playlist"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="edit-description" className="text-gray-700 font-medium">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editingPlaylist.description || ''}
                  onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Descrição da playlist"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="edit-cover" className="text-gray-700 font-medium">URL da Capa</Label>
                <Input
                  id="edit-cover"
                  value={editingPlaylist.cover_url || ''}
                  onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, cover_url: e.target.value } : null)}
                  placeholder="https://exemplo.com/capa.jpg"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-public"
                  checked={editingPlaylist.is_public}
                  onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, is_public: e.target.checked } : null)}
                />
                <Label htmlFor="edit-public" className="text-gray-700">Playlist pública</Label>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => handleUpdatePlaylist(editingPlaylist, editingPlaylist)} 
                  className="flex-1"
                >
                  <Save size={16} className="mr-2" />
                  Salvar Alterações
                </Button>
                <Button variant="outline" onClick={() => setEditingPlaylist(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}