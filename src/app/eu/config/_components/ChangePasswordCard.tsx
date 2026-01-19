"use client";

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Loader2, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { translateSupabaseAuthErrorToPtBr } from '@/lib/auth-error-ptbr';
import { toast } from 'sonner';

const MIN_PASSWORD_LENGTH = 6;

type ChangePasswordFormValues = {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
};

interface ChangePasswordCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

const getAuthErrorMessage = (error: unknown, fallback: string) => {
  const translated = translateSupabaseAuthErrorToPtBr(error);
  if (translated) return translated;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
};

const getProviderLabel = (provider?: string) => {
  if (!provider) return null;
  const normalized = provider.toLowerCase();
  const known: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    facebook: 'Facebook',
    github: 'GitHub',
  };
  return known[normalized] ?? 'login social';
};

export function ChangePasswordCard({ isOpen, onToggle }: ChangePasswordCardProps) {
  const { user } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);

  const { requiresCurrentPassword, providerLabel } = useMemo(() => {
    const identityProvider = user?.identities?.[0]?.provider;
    const provider = user?.app_metadata?.provider ?? identityProvider;
    const providers = user?.app_metadata?.providers ?? [];
    const hasEmailIdentity = user?.identities?.some((identity) => identity.provider === 'email');
    const hasEmailProvider = provider === 'email' || providers.includes('email') || hasEmailIdentity;
    const displayProvider = hasEmailProvider ? null : getProviderLabel(provider);
    return {
      requiresCurrentPassword: Boolean(hasEmailProvider),
      providerLabel: displayProvider,
    };
  }, [user]);

  const schema = useMemo(() => {
    const baseSchema = z.object({
      currentPassword: requiresCurrentPassword
        ? z.string().min(1, 'Informe sua senha atual.')
        : z.string().optional(),
      newPassword: z
        .string()
        .min(MIN_PASSWORD_LENGTH, `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`),
      confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
    });

    return baseSchema.superRefine((data, ctx) => {
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPassword'],
          message: 'As senhas não conferem.',
        });
      }

      if (requiresCurrentPassword && data.currentPassword && data.currentPassword === data.newPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newPassword'],
          message: 'A nova senha precisa ser diferente da atual.',
        });
      }
    });
  }, [requiresCurrentPassword]);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleResetPasswordEmail = async () => {
    if (!user?.email) {
      toast.error('Não foi possível localizar seu e-mail.');
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        toast.error(getAuthErrorMessage(error, 'Não foi possível enviar o e-mail de redefinição.'));
        return;
      }

      toast.success('Enviamos um e-mail com as instruções para redefinir sua senha.');
    } catch (error) {
      toast.error(getAuthErrorMessage(error, 'Não foi possível enviar o e-mail de redefinição.'));
    } finally {
      setSendingReset(false);
    }
  };

  const handleSubmit = async (values: ChangePasswordFormValues) => {
    if (!user?.email) {
      toast.error('Não foi possível localizar seu e-mail.');
      return;
    }

    try {
      if (requiresCurrentPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: values.currentPassword ?? '',
        });

        if (verifyError) {
          const message = getAuthErrorMessage(verifyError, 'Senha atual incorreta.');
          form.setError('currentPassword', { message });
          toast.error(message);
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) {
        const message = getAuthErrorMessage(updateError, 'Não foi possível atualizar a senha.');
        form.setError('newPassword', { message });
        toast.error(message);
        return;
      }

      toast.success('Senha atualizada com sucesso. Você continua conectado.');
      form.reset();
    } catch (error) {
      toast.error(getAuthErrorMessage(error, 'Não foi possível atualizar a senha.'));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          onClick={onToggle}
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
        >
          <div className="flex items-center space-x-3 text-left">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            <div>
              <CardTitle className="text-white font-medium text-lg">Segurança</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Atualize sua senha de acesso</p>
            </div>
          </div>
          <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </Button>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          <div className="border-t border-gray-800 pt-4 space-y-4">
            {!requiresCurrentPassword && (
              <div className="rounded-md border border-gray-800 bg-gray-900/40 p-3 text-sm text-gray-400">
                {providerLabel
                  ? `Você entra com ${providerLabel}. Crie uma senha para acessar também por e-mail.`
                  : 'Você entra com login social. Crie uma senha para acessar também por e-mail.'}
              </div>
            )}

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {requiresCurrentPassword && (
                <div>
                  <Label htmlFor="current_password" className="text-sm text-gray-300">
                    Senha atual
                  </Label>
                  <Input
                    id="current_password"
                    type="password"
                    autoComplete="current-password"
                    {...form.register('currentPassword')}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    placeholder="Digite sua senha atual"
                  />
                  {form.formState.errors.currentPassword && (
                    <p className="text-red-400 text-xs mt-1">
                      {form.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="new_password" className="text-sm text-gray-300">
                  Nova senha
                </Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('newPassword')}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder={`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
                />
                {form.formState.errors.newPassword ? (
                  <p className="text-red-400 text-xs mt-1">
                    {form.formState.errors.newPassword.message}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Dica: combine letras e números para uma senha mais forte.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirm_password" className="text-sm text-gray-300">
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="Repita a nova senha"
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || sendingReset}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Atualizar senha'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetPasswordEmail}
                  disabled={form.formState.isSubmitting || sendingReset}
                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  {sendingReset ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando e-mail...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Esqueci minha senha
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
