"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Loader2, Save, Edit2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function ProfileEditCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    whatsapp: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Buscar dados do perfil
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, whatsapp, avatar_url')
        .eq('id', user.id)
        .single();

      // Erros esperados que não devem ser logados:
      // - PGRST116: registro não encontrado (esperado para novos usuários)
      // - 42703: coluna não existe (esperado se migration não foi executada ainda)
      // - 42883: coluna não existe (outro código possível)
      const expectedErrors = ['PGRST116', '42703', '42883'];
      const errorCode = error?.code || error?.message?.match(/42703|42883/)?.[0];
      
      if (error && !expectedErrors.includes(errorCode)) {
        // Apenas logar erros reais e inesperados
        console.error('Erro ao carregar perfil:', error);
      }

      // Buscar WhatsApp da tabela whatsapp_users (fonte principal)
      let whatsapp = data?.whatsapp || '';
      if (!whatsapp) {
        try {
          const { data: whatsappData } = await supabase
            .from('whatsapp_users')
            .select('phone_number')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (whatsappData?.phone_number) {
            // Formatar o número para exibição (remover código do país se for +55)
            const phoneNumber = whatsappData.phone_number.replace(/\D/g, '');
            if (phoneNumber.startsWith('55') && phoneNumber.length >= 12) {
              // Formatar como +55 (XX) XXXXX-XXXX
              const ddd = phoneNumber.slice(2, 4);
              const number = phoneNumber.slice(4);
              if (number.length === 9) {
                whatsapp = `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
              } else if (number.length === 8) {
                whatsapp = `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
              } else {
                whatsapp = `+55 ${phoneNumber.slice(2)}`;
              }
            } else {
              whatsapp = whatsappData.phone_number;
            }
          }
        } catch (whatsappError: any) {
          // Ignorar erros ao buscar whatsapp_users (pode não ter user_id ainda)
          const errorMessage = whatsappError?.message || '';
          const isExpectedError = errorMessage.includes('user_id') || 
                                   errorMessage.includes('schema cache') ||
                                   errorMessage.includes('42703') ||
                                   errorMessage.includes('42883');
          if (!isExpectedError) {
            console.warn('Erro ao buscar WhatsApp de whatsapp_users:', whatsappError);
          }
        }
      }

      // Tentar carregar whatsapp do localStorage como último recurso
      if (!whatsapp && typeof window !== 'undefined') {
        const savedWhatsapp = localStorage.getItem(`whatsapp_${user.id}`);
        if (savedWhatsapp) {
          whatsapp = savedWhatsapp;
        }
      }

      setProfile({
        full_name: data?.full_name || user.user_metadata?.full_name || '',
        email: user.email || '',
        whatsapp: whatsapp,
        avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || '',
      });
    } catch (error: any) {
      // Verificar se é erro esperado de coluna não encontrada
      const errorMessage = error?.message || '';
      const isExpectedError = errorMessage.includes('42703') || 
                               errorMessage.includes('42883') ||
                               (errorMessage.includes('column') && errorMessage.includes('does not exist'));
      
      if (!isExpectedError) {
        // Apenas logar erros reais e inesperados
        console.error('Erro ao carregar perfil:', error);
      }
      
      // Tentar buscar WhatsApp de whatsapp_users mesmo em caso de erro
      let whatsapp = '';
      try {
        const { data: whatsappData } = await supabase
          .from('whatsapp_users')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (whatsappData?.phone_number) {
          const phoneNumber = whatsappData.phone_number.replace(/\D/g, '');
          if (phoneNumber.startsWith('55') && phoneNumber.length >= 12) {
            const ddd = phoneNumber.slice(2, 4);
            const number = phoneNumber.slice(4);
            if (number.length === 9) {
              whatsapp = `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
            } else if (number.length === 8) {
              whatsapp = `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
            } else {
              whatsapp = `+55 ${phoneNumber.slice(2)}`;
            }
          } else {
            whatsapp = whatsappData.phone_number;
          }
        }
      } catch {
        // Ignorar erros ao buscar whatsapp_users
      }

      // Tentar carregar do localStorage como último recurso
      if (!whatsapp && typeof window !== 'undefined') {
        const savedWhatsapp = localStorage.getItem(`whatsapp_${user.id}`);
        if (savedWhatsapp) {
          whatsapp = savedWhatsapp;
        }
      }

      setProfile({
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        whatsapp: whatsapp,
        avatar_url: user.user_metadata?.avatar_url || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `app-26/avatars/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('media').getPublicUrl(filePath);
      if (!data?.publicUrl) {
        throw new Error('Não foi possível obter URL pública do avatar');
      }

      setProfile((prev) => ({ ...prev, avatar_url: data.publicUrl }));
      toast.success('Foto enviada. Clique em salvar para aplicar.');
    } catch (error) {
      console.error('Erro ao fazer upload do avatar:', error);
      toast.error('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const saveProfileViaApiFallback = async () => {
    const response = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        full_name: profile.full_name,
        whatsapp: profile.whatsapp,
        avatar_url: profile.avatar_url,
      }),
    });

    if (!response.ok) {
      let message = 'Falha ao salvar perfil';
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        // Ignora erro de parse
      }
      throw new Error(message);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Atualizar perfil na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: profile.full_name,
          whatsapp: profile.whatsapp,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        // Verificar se é erro de coluna não existe (migration não executada)
        const errorMessage = profileError?.message || '';
        const isColumnError = errorMessage.includes('42703') || 
                              errorMessage.includes('42883') ||
                              (errorMessage.includes('column') && errorMessage.includes('does not exist'));
        
        if (isColumnError) {
          // Se a coluna whatsapp não existe, tentar salvar apenas campos que existem
          const { error: fallbackError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id'
            });
          
          if (fallbackError) {
            throw fallbackError;
          }
          
          // Salvar whatsapp no localStorage como fallback temporário
          if (profile.whatsapp) {
            localStorage.setItem(`whatsapp_${user.id}`, profile.whatsapp);
          }
        } else {
          throw profileError;
        }
      }

      // Atualizar WhatsApp na tabela whatsapp_users também
      if (profile.whatsapp) {
        try {
          // Limpar formatação do número para salvar apenas dígitos
          const cleanPhone = profile.whatsapp.replace(/\D/g, '');
          
          // Verificar se já existe registro na tabela whatsapp_users
          const { data: existingWhatsApp } = await supabase
            .from('whatsapp_users')
            .select('phone_number, user_id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (existingWhatsApp || cleanPhone) {
            // Preparar payload para whatsapp_users
            const whatsappPayload: any = {
              user_id: user.id,
              phone_number: cleanPhone,
              name: profile.full_name || user.email?.split('@')[0] || 'Irmão(ã)',
              updated_at: new Date().toISOString(),
            };
            
            // Se já existe registro, fazer upsert pelo user_id
            if (existingWhatsApp) {
              const { error: whatsappError } = await supabase
                .from('whatsapp_users')
                .update({
                  phone_number: cleanPhone,
                  name: whatsappPayload.name,
                  updated_at: whatsappPayload.updated_at,
                })
                .eq('user_id', user.id);
              
              if (whatsappError) {
                // Ignorar erros de user_id não existir (migration não executada)
                const errorMessage = whatsappError?.message || '';
                const isExpectedError = errorMessage.includes('user_id') || 
                                       errorMessage.includes('schema cache');
                if (!isExpectedError) {
                  console.warn('Erro ao atualizar whatsapp_users:', whatsappError);
                }
              }
            } else {
              // Tentar criar novo registro
              const { error: whatsappError } = await supabase
                .from('whatsapp_users')
                .upsert(whatsappPayload, { onConflict: 'phone_number' });
              
              if (whatsappError) {
                // Ignorar erros de user_id não existir (migration não executada)
                const errorMessage = whatsappError?.message || '';
                const isExpectedError = errorMessage.includes('user_id') || 
                                       errorMessage.includes('schema cache');
                if (!isExpectedError) {
                  console.warn('Erro ao salvar whatsapp_users:', whatsappError);
                }
              }
            }
          }
        } catch (whatsappError: any) {
          // Ignorar erros ao salvar whatsapp_users (pode não ter user_id ainda)
          const errorMessage = whatsappError?.message || '';
          const isExpectedError = errorMessage.includes('user_id') || 
                                 errorMessage.includes('schema cache');
          if (!isExpectedError) {
            console.warn('Erro ao salvar WhatsApp em whatsapp_users:', whatsappError);
          }
        }
      }

      // Atualizar metadata do usuário no auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      });

      if (authError) {
        console.warn('Erro ao atualizar metadata do auth:', authError);
        // Não falhar completamente se apenas o auth falhar
      }

      toast.success('Perfil atualizado com sucesso');
      setIsEditing(false);
      
      // Recarregar página para atualizar contexto
      window.location.reload();
    } catch (error: any) {
      try {
        await saveProfileViaApiFallback();
        toast.success('Perfil atualizado com sucesso');
        setIsEditing(false);
        window.location.reload();
        return;
      } catch (apiError: any) {
        // Verificar se é erro esperado de coluna não encontrada
        const errorMessage = error?.message || '';
        const isExpectedError = errorMessage.includes('42703') || 
                                 errorMessage.includes('42883') ||
                                 (errorMessage.includes('column') && errorMessage.includes('does not exist'));
        
        if (!isExpectedError) {
          console.error('Erro ao salvar perfil:', error);
        }

        const apiErrorMessage = apiError?.message || '';
        if (apiErrorMessage) {
          console.error('Erro ao salvar perfil via API:', apiErrorMessage);
        }
        
        toast.error('Erro ao salvar perfil');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
        >
          <div className="flex items-center space-x-3 text-left">
            <User className="h-6 w-6 text-green-500" />
            <div>
              <CardTitle className="text-white font-medium text-lg">Perfil</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Edite suas informações pessoais</p>
            </div>
          </div>
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="border-t border-gray-800 pt-4 space-y-4">
            {/* Avatar */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="bg-gray-700 text-white text-xl">
                  {profile.full_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="flex-1 space-y-2">
                  <Label htmlFor="avatar_file" className="text-sm text-gray-400 mb-1 block">
                    Foto do perfil
                  </Label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="avatar_file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <Label htmlFor="avatar_file">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-600 text-gray-200 hover:bg-gray-800"
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Enviar foto
                          </>
                        )}
                      </Button>
                    </Label>
                    {profile.avatar_url && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">
                        Foto pronta para salvar
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Use uma imagem quadrada para melhor resultado. O upload substitui a foto atual.
                  </p>
                </div>
              )}
            </div>

            {/* Nome */}
            <div>
              <Label htmlFor="full_name" className="text-sm text-gray-400 mb-1 block">
                Nome
              </Label>
              {isEditing ? (
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Seu nome"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              ) : (
                <p className="text-white">{profile.full_name || 'Não informado'}</p>
              )}
            </div>

            {/* E-mail */}
            <div>
              <Label htmlFor="email" className="text-sm text-gray-400 mb-1 block">
                E-mail
              </Label>
              <p className="text-white">{profile.email}</p>
              <p className="text-xs text-gray-500 mt-1">E-mail não pode ser alterado</p>
            </div>

            {/* WhatsApp */}
            <div>
              <Label htmlFor="whatsapp" className="text-sm text-gray-400 mb-1 block">
                WhatsApp
              </Label>
              {isEditing ? (
                <Input
                  id="whatsapp"
                  value={profile.whatsapp}
                  onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                  placeholder="+55 11 99999-9999"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              ) : (
                <p className="text-white">{profile.whatsapp || 'Não informado'}</p>
              )}
            </div>

            {/* Botões de ação */}
            {isEditing && (
              <div className="flex space-x-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    loadProfile();
                  }}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancelar
                </Button>
              </div>
            )}
            
            {/* Botão Editar quando não está editando */}
            {!isEditing && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="group w-full border-gray-600 text-black hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Edit2 className="h-4 w-4 mr-2 text-black group-hover:text-white transition-colors" />
                  Editar Perfil
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
