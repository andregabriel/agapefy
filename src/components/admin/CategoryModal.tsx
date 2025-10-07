"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Upload, Image, Layout, Smartphone, Grid3X3, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface CategoryModalProps {
  category: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const LAYOUT_OPTIONS = [
  {
    value: 'spotify',
    label: 'Padrão Spotify',
    description: 'Layout horizontal com scroll (padrão atual)',
    icon: MoreHorizontal
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Card maior, altura dobrada, full width no mobile',
    icon: Smartphone
  },
  {
    value: 'grid_3_rows',
    label: 'Grid 3 linhas',
    description: 'Exibição em grid com 3 linhas e N colunas',
    icon: Grid3X3
  },
  {
    value: 'double_height',
    label: 'Altura dobrada',
    description: 'Mesmo layout atual mas com altura 2x',
    icon: Layout
  }
];

export default function CategoryModal({ category, isOpen, onClose, onSave }: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    layout_type: 'spotify',
    is_visible: true,
  });
  const [loading, setLoading] = useState(false);

  // Helpers para draft persistence
  const getDraftKey = () => {
    const base = 'admin.draft.category';
    if (category?.id) return `${base}.edit.${category.id}`;
    return `${base}.new`;
  };

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        image_url: category.image_url || '',
        layout_type: category.layout_type || 'spotify',
        is_visible: category.is_visible !== false,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        image_url: '',
        layout_type: 'spotify',
        is_visible: true,
      });
    }
  }, [category]);

  // Restaurar draft ao abrir modal
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        setFormData(prev => ({ ...prev, ...draft }));
      }
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, category?.id]);

  // Salvar draft quando editar campos com modal aberto
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isOpen, category?.id]);

  // Limpar draft ao fechar modal
  const clearDraft = () => {
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.removeItem(key);
    } catch (_) {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Por favor, insira um nome para a categoria');
      return;
    }

    setLoading(true);

    try {
      console.log('💾 Salvando categoria:', { 
        isEdit: !!category, 
        categoryId: category?.id,
        formData 
      });

      if (category) {
        // Atualizar categoria existente
        console.log('✏️ Atualizando categoria existente...');
        const wasHidden = category.is_visible === false;
        const willBeVisible = formData.is_visible !== false;
        const payload: any = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          image_url: formData.image_url.trim() || null,
          layout_type: formData.layout_type,
          is_visible: formData.is_visible,
        };

        // Se estava oculta e ficará visível (e não é fixa), force reassign de posição
        if (wasHidden && willBeVisible && !category.is_featured) {
          payload.order_position = null;
        }

        const { data, error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', category.id)
          .select();

        if (error) {
          console.error('❌ Erro ao atualizar categoria:', error);
          throw error;
        }

        console.log('✅ Categoria atualizada com sucesso:', data);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        // Criar nova categoria
        console.log('➕ Criando nova categoria...');
        const { data, error } = await supabase
          .from('categories')
          .insert([{
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            image_url: formData.image_url.trim() || null,
            layout_type: formData.layout_type,
            is_visible: formData.is_visible,
          }])
          .select();

        if (error) {
          console.error('❌ Erro ao criar categoria:', error);
          throw error;
        }

        console.log('✅ Categoria criada com sucesso:', data);
        toast.success('Categoria criada com sucesso!');
      }

      onSave();
      clearDraft();
      onClose();
    } catch (error: any) {
      console.error('❌ Erro detalhado ao salvar categoria:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });

      // Tratamento específico de erros
      let errorMessage = 'Erro ao salvar categoria';
      
      if (error.code === '42501') {
        errorMessage = 'Você não tem permissão para realizar esta ação. Faça login como administrador.';
      } else if (error.code === '23505') {
        errorMessage = 'Já existe uma categoria com este nome.';
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {category ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
          <button 
            onClick={() => {
              clearDraft();
              onClose();
            }} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Visibilidade na Home */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Exibição na Home
              </label>
              <p className="text-xs text-gray-500">Desmarque para ocultar esta categoria da página inicial</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_visible}
                onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-800">Mostrar</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Categoria *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Ex: Orações Matinais"
              required
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Breve descrição da categoria..."
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL da Imagem
            </label>
            <div className="space-y-2">
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                placeholder="https://exemplo.com/imagem.jpg"
              />
              {formData.image_url && (
                <div className="mt-2">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              URL da imagem que representará a categoria
            </p>
          </div>

          {/* Seletor de Layout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Layout da Categoria na Home
            </label>
            <div className="space-y-3">
              {LAYOUT_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`
                      relative flex items-start p-3 border rounded-lg cursor-pointer transition-all
                      ${formData.layout_type === option.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                    onClick={() => setFormData({ ...formData, layout_type: option.value })}
                  >
                    <input
                      type="radio"
                      name="layout_type"
                      value={option.value}
                      checked={formData.layout_type === option.value}
                      onChange={(e) => setFormData({ ...formData, layout_type: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex items-center w-full">
                      <div className={`
                        flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-3
                        ${formData.layout_type === option.value
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-500'
                        }
                      `}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`
                            font-medium text-sm
                            ${formData.layout_type === option.value
                              ? 'text-blue-900'
                              : 'text-gray-900'
                            }
                          `}>
                            {option.label}
                          </h4>
                          {formData.layout_type === option.value && (
                            <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                        <p className={`
                          text-xs mt-1
                          ${formData.layout_type === option.value
                            ? 'text-blue-700'
                            : 'text-gray-500'
                          }
                        `}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Escolha como esta categoria será exibida na página inicial
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors order-2 sm:order-1"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {category ? 'Atualizar' : 'Salvar'} Categoria
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}