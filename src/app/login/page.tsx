"use client";

import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Mail } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up' | 'forgotten_password'>('sign_in');

  useEffect(() => {
    if (user && !loading) {
      // Não expor e-mail do usuário no console do navegador
      console.log('👤 LoginPage: Usuário logado');
      
      // Verificar se é admin e redirecionar
      const checkAdminAndRedirect = async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          console.log('👤 LoginPage: Perfil encontrado:', profile);

          if (profile?.role === 'admin') {
            console.log('🔑 LoginPage: Redirecionando admin para /admin');
            router.push('/admin');
          } else {
            console.log('👤 LoginPage: Redirecionando usuário para /');
            router.push('/');
          }
        } catch (error) {
          console.error('Erro ao verificar perfil:', error);
          router.push('/');
        }
      };

      checkAdminAndRedirect();
    }
  }, [user, loading, router]);

  const handleGuestMode = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('guestMode', 'true');
    }
    router.push('/');
  };

  // IMPLEMENTAÇÃO CORRIGIDA: Detectar modo baseado no botão principal ativo
  useEffect(() => {
    if (!showEmailAuth) return;

    let intervalId: NodeJS.Timeout;

    const detectAuthMode = () => {
      // Procurar pelo botão principal para determinar o modo ATIVO
      const buttons = document.querySelectorAll('button');
      
      let currentMode: 'sign_in' | 'sign_up' | 'forgotten_password' = 'sign_in';
      
      // Verificar qual é o botão principal ativo (não disabled, visível)
      buttons.forEach(button => {
        const text = button.textContent?.toLowerCase() || '';
        const isDisabled = button.disabled;
        const isHidden = button.style.display === 'none' || button.hidden;
        
        // Só considerar botões ativos e visíveis
        if (!isDisabled && !isHidden) {
          if (text.includes('criar conta') || text.includes('criando conta')) {
            currentMode = 'sign_up';
          } else if (text.includes('enviar instruções') || text.includes('enviando') || text.includes('recuperar')) {
            currentMode = 'forgotten_password';
          } else if (text.includes('entrar') || text.includes('entrando')) {
            currentMode = 'sign_in';
          }
        }
      });
      
      // Atualizar estado se mudou
      if (currentMode !== authView) {
        console.log('🔄 Auth mode changed to:', currentMode);
        setAuthView(currentMode);
      }
    };

    // Verificar imediatamente
    detectAuthMode();
    
    // Verificar a cada 500ms
    intervalId = setInterval(detectAuthMode, 500);

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showEmailAuth, authView]);

  // FALLBACK JS - Forçar cor branca via inline styles e detectar autofill
  useEffect(() => {
    if (!showEmailAuth) return;

    const applyInlineColor = () => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        '.auth-container input.supabase-auth-ui_ui-input, .auth-container input[type="email"], .auth-container input[type="password"]'
      );
      inputs.forEach((el) => {
        // Forçar cor branca do texto sempre
        el.style.setProperty('color', '#ffffff', 'important');
        el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
        el.style.setProperty('caret-color', '#ffffff', 'important');
        
        // Verificar se tem autofill aplicado (via getComputedStyle ou valor preenchido)
        const hasValue = el.value && el.value.length > 0;
        const computedStyle = window.getComputedStyle(el);
        const bgColor = computedStyle.backgroundColor;
        
        // Se o campo tem valor ou parece ter autofill, garantir fundo escuro
        if (hasValue || bgColor === 'rgb(31, 41, 55)' || el.classList.contains('autofilled')) {
          el.style.setProperty('background-color', '#1f2937', 'important');
          el.style.setProperty('-webkit-box-shadow', '0 0 0 30px #1f2937 inset', 'important');
          el.style.setProperty('box-shadow', '0 0 0 30px #1f2937 inset', 'important');
        }
      });
    };

    // Observer para detectar mudanças nos inputs (incluindo autofill)
    const observer = new MutationObserver(() => {
      applyInlineColor();
    });

    // Aplica imediatamente
    applyInlineColor();
    
    // Armazenar referências dos handlers para cleanup
    const handlers: Array<{ element: Element; event: string; handler: EventListener }> = [];
    
    // Observa mudanças nos inputs
    const inputs = document.querySelectorAll('.auth-container input');
    inputs.forEach((input) => {
      observer.observe(input, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: false,
        subtree: false,
      });
      
      // Handler para animationstart (autofill)
      const handleAnimationStart = (e: Event) => {
        if ((e as any).animationName === 'onAutoFillStart') {
          (input as HTMLElement).classList.add('autofilled');
          applyInlineColor();
        }
      };
      
      // Handler para input (incluindo biometria)
      const handleInput = () => {
        if ((input as HTMLInputElement).value) {
          (input as HTMLElement).classList.add('autofilled');
        }
        applyInlineColor();
      };
      
      // Handler para change
      const handleChange = () => {
        if ((input as HTMLInputElement).value) {
          (input as HTMLElement).classList.add('autofilled');
        }
        applyInlineColor();
      };
      
      // Handler para focus (Safari/Mac autofill)
      const handleFocus = () => {
        setTimeout(applyInlineColor, 100);
      };
      
      // Handler para blur (detectar autofill após perder foco)
      const handleBlur = () => {
        if ((input as HTMLInputElement).value) {
          (input as HTMLElement).classList.add('autofilled');
          applyInlineColor();
        }
      };
      
      // Adicionar listeners e armazenar referências
      input.addEventListener('animationstart', handleAnimationStart);
      handlers.push({ element: input, event: 'animationstart', handler: handleAnimationStart });
      
      input.addEventListener('input', handleInput);
      handlers.push({ element: input, event: 'input', handler: handleInput });
      
      input.addEventListener('change', handleChange);
      handlers.push({ element: input, event: 'change', handler: handleChange });
      
      input.addEventListener('focus', handleFocus);
      handlers.push({ element: input, event: 'focus', handler: handleFocus });
      
      input.addEventListener('blur', handleBlur);
      handlers.push({ element: input, event: 'blur', handler: handleBlur });
    });

    // Re-aplica em intervalos para garantir
    const t1 = setTimeout(applyInlineColor, 50);
    const t2 = setTimeout(applyInlineColor, 250);
    const t3 = setTimeout(applyInlineColor, 500);
    const t4 = setTimeout(applyInlineColor, 1000);

    return () => { 
      clearTimeout(t1); 
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      observer.disconnect();
      // Remover todos os listeners usando as referências armazenadas
      handlers.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    };
  }, [showEmailAuth]);

  // Função para obter o título baseado no modo atual
  const getTitle = () => {
    switch (authView) {
      case 'sign_up':
        return 'Cadastrar uma nova conta';
      case 'forgotten_password':
        return 'Recuperar Senha';
      default:
        return 'Entrar com E-mail';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Modal de autenticação por email
  if (showEmailAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header com botão fechar e título dinâmico */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-white">
              {getTitle()}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowEmailAuth(false);
                setAuthView('sign_in'); // Reset para sign_in quando fechar
              }}
              className="text-gray-400 hover:text-white p-2"
            >
              <X size={24} />
            </Button>
          </div>

          {/* Formulário de autenticação */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <Auth
              supabaseClient={supabase}
              providers={[]}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#10b981',
                      brandAccent: '#059669',
                      inputBackground: '#1f2937',
                      inputBorder: '#374151',
                      inputText: '#ffffff',
                      inputPlaceholder: '#9ca3af',
                    },
                  },
                },
                className: {
                  container: 'auth-container',
                  button: 'auth-button',
                  input: 'auth-input',
                }
              }}
              theme="dark"
              options={{
                emailRedirectTo: undefined, // Remove redirecionamento
                data: {
                  email_confirm: false, // Não exigir confirmação de email
                }
              }}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    button_label: 'Entrar',
                    loading_button_label: 'Entrando...',
                    link_text: 'Já tem uma conta? Entre aqui',
                    password_input_placeholder: 'Sua senha',
                    email_input_placeholder: 'Seu e-mail',
                  },
                  sign_up: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    button_label: 'Criar conta',
                    loading_button_label: 'Criando conta...',
                    link_text: 'Não tem uma conta? Crie aqui',
                    password_input_placeholder: 'Crie uma senha',
                    email_input_placeholder: 'Seu e-mail',
                    confirmation_text: 'Conta criada com sucesso! Redirecionando...',
                  },
                  forgotten_password: {
                    email_label: 'E-mail',
                    button_label: 'Enviar instruções',
                    loading_button_label: 'Enviando...',
                    link_text: 'Esqueceu sua senha?',
                    confirmation_text: 'Verifique seu e-mail para redefinir a senha',
                  },
                  magic_link: {
                    email_label: 'E-mail',
                    button_label: 'Enviar link mágico',
                    loading_button_label: 'Enviando...',
                    link_text: 'Enviar um link mágico por e-mail',
                    confirmation_text: 'Verifique seu e-mail para o link de confirmação',
                  },
                },
                // TRADUÇÕES DE MENSAGENS DE ERRO
                lang: {
                  'Invalid login credentials': 'Credenciais de login inválidas',
                  'User already registered': 'Usuário já cadastrado',
                  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
                  'Unable to validate email address: invalid format': 'Não foi possível validar o endereço de e-mail: formato inválido',
                  'Email not confirmed': 'E-mail não confirmado',
                  'Too many requests': 'Muitas tentativas. Tente novamente mais tarde',
                  'Invalid email': 'E-mail inválido',
                  'Password is required': 'Senha é obrigatória',
                  'Email is required': 'E-mail é obrigatório',
                  'Signup requires a valid password': 'O cadastro requer uma senha válida',
                  'User not found': 'Usuário não encontrado',
                  'Email address not confirmed': 'Endereço de e-mail não confirmado',
                  'Invalid password': 'Senha inválida',
                  'Weak password': 'Senha muito fraca',
                  'Password must be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
                  'Email already in use': 'E-mail já está em uso',
                  'Account not found': 'Conta não encontrada',
                  'Network error': 'Erro de rede. Verifique sua conexão',
                  'Server error': 'Erro do servidor. Tente novamente',
                  'Authentication failed': 'Falha na autenticação',
                  'Session expired': 'Sessão expirada',
                  'Access denied': 'Acesso negado',
                  'Rate limit exceeded': 'Limite de tentativas excedido',
                  'Email link is invalid or has expired': 'O link do e-mail é inválido ou expirou',
                  'Token has expired or is invalid': 'O token expirou ou é inválido',
                  'Unable to process request': 'Não foi possível processar a solicitação',
                  'Something went wrong': 'Algo deu errado. Tente novamente',
                  'Please check your email': 'Por favor, verifique seu e-mail',
                  'Check your email for the confirmation link': 'Verifique seu e-mail para o link de confirmação',
                  'Password reset email sent': 'E-mail de redefinição de senha enviado',
                  'Account created successfully': 'Conta criada com sucesso',
                  'Logged in successfully': 'Login realizado com sucesso',
                  'Logged out successfully': 'Logout realizado com sucesso',
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Tela principal de login inspirada na imagem
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      {/* Botão fechar no canto superior direito - CORRIGIDO PARA SER CLICÁVEL */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleGuestMode}
          className="text-gray-400 hover:text-white bg-gray-800/50 backdrop-blur-sm rounded-full p-3 transition-colors cursor-pointer border-none outline-none"
          style={{ pointerEvents: 'auto' }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Ilustração de fundo - simulando mãos em oração */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <div className="text-9xl">🙏</div>
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Logo e título */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">Agapefy</h1>
        </div>

        {/* Botões de autenticação */}
        <div className="w-full max-w-sm space-y-4">
          {/* Continuar com Google */}
          <Button
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google'
              });
              if (error) console.error('Erro no login com Google:', error);
            }}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-4 px-6 rounded-full flex items-center justify-center gap-3 text-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com o Google
          </Button>

          {/* Continuar com E-mail */}
          <Button
            onClick={() => setShowEmailAuth(true)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-full flex items-center justify-center gap-3 text-lg transition-all duration-200"
          >
            <Mail size={20} />
            Continuar com E-mail
          </Button>
        </div>

        {/* Termos de uso */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400 max-w-xs">
            Ao usar a Agapefy, você concorda com nossos{' '}
            <Link href="/termos-de-uso" className="text-green-400 underline cursor-pointer hover:text-green-300">
              Termos de Uso
            </Link>
            {' '}e{' '}
            <Link href="/politica-de-privacidade" className="text-green-400 underline cursor-pointer hover:text-green-300">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>

      {/* CAMADA A - CSS CIRÚRGICO PARA SUPABASE AUTH UI */}
      <style jsx global>{`
        /* 1) Se o tema estiver usando variável interna, já garantimos aqui */
        :root {
          --colors-inputText: #ffffff !important;
        }

        /* 2) Alvo cirúrgico: inputs do Supabase Auth UI */
        .auth-container input.supabase-auth-ui_ui-input,
        .auth-container input[type="email"].supabase-auth-ui_ui-input,
        .auth-container input[type="password"].supabase-auth-ui_ui-input,
        .auth-container #email.supabase-auth-ui_ui-input,
        .auth-container #password.supabase-auth-ui_ui-input {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
        }

        /* 3) Mesmo efeito quando focado */
        .auth-container input.supabase-auth-ui_ui-input:focus {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
        }

        /* 4) Autofill do Chrome/Safari (mantém texto branco) */
        .auth-container input.supabase-auth-ui_ui-input:-webkit-autofill,
        .auth-container input.supabase-auth-ui_ui-input:-webkit-autofill:hover,
        .auth-container input.supabase-auth-ui_ui-input:-webkit-autofill:focus,
        .auth-container input.supabase-auth-ui_ui-input:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0 30px #1f2937 inset !important;
          box-shadow: 0 0 0 30px #1f2937 inset !important;
          caret-color: #ffffff !important;
          color: #ffffff !important;
          background-color: #1f2937 !important;
          transition: background-color 5000s ease-in-out 0s !important;
        }

        /* 5) Animação para detectar autofill */
        @keyframes onAutoFillStart {
          from {
            opacity: 0;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes onAutoFillCancel {
          from {
            opacity: 0;
          }
          to {
            opacity: 0;
          }
        }

        .auth-container input.supabase-auth-ui_ui-input:-webkit-autofill {
          animation-name: onAutoFillStart;
          animation-duration: 0.001s;
        }

        /* 6) Garantir que todos os inputs tenham texto branco */
        .auth-container input[type="email"],
        .auth-container input[type="password"],
        .auth-container input[type="text"] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .auth-container input[type="email"]:-webkit-autofill,
        .auth-container input[type="password"]:-webkit-autofill,
        .auth-container input[type="text"]:-webkit-autofill {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0 30px #1f2937 inset !important;
          box-shadow: 0 0 0 30px #1f2937 inset !important;
          color: #ffffff !important;
        }

        /* 7) Estilos para campos marcados como autofilled (biometria) */
        .auth-container input.autofilled,
        .auth-container input.autofilled:-webkit-autofill {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: #1f2937 !important;
          -webkit-box-shadow: 0 0 0 30px #1f2937 inset !important;
          box-shadow: 0 0 0 30px #1f2937 inset !important;
        }

        /* 8) Forçar texto branco em qualquer estado do input com valor */
        .auth-container input[type="email"]:not(:placeholder-shown),
        .auth-container input[type="password"]:not(:placeholder-shown),
        .auth-container input[type="text"]:not(:placeholder-shown) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        /* Estilos básicos do Auth UI */
        .auth-container {
          background: transparent !important;
        }
        .auth-button {
          background: #10b981 !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 12px 24px !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
          color: #ffffff !important;
        }
        .auth-button:hover {
          background: #059669 !important;
          transform: translateY(-1px) !important;
        }
        
        /* Inputs básicos */
        .auth-input,
        input[type="email"],
        input[type="password"],
        input[type="text"],
        #email,
        #password {
          background: #1f2937 !important;
          border: 1px solid #374151 !important;
          border-radius: 12px !important;
          padding: 12px 16px !important;
          font-size: 16px !important;
          font-weight: 500 !important;
        }
        
        /* Focus states */
        .auth-input:focus,
        input[type="email"]:focus,
        input[type="password"]:focus,
        input[type="text"]:focus,
        #email:focus,
        #password:focus {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1) !important;
          outline: none !important;
        }
        
        /* Placeholders */
        .auth-input::placeholder,
        input[type="email"]::placeholder,
        input[type="password"]::placeholder,
        input[type="text"]::placeholder,
        #email::placeholder,
        #password::placeholder {
          color: #9ca3af !important;
          opacity: 1 !important;
        }
        
        /* Labels */
        .auth-container label {
          color: #ffffff !important;
          font-weight: 500 !important;
          margin-bottom: 8px !important;
        }
        
        /* Links */
        .auth-container a {
          color: #10b981 !important;
        }
        
        .auth-container a:hover {
          color: #059669 !important;
        }

        /* Mensagens */
        .supabase-auth-ui_ui-message {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}