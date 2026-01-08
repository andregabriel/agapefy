export type SubscriptionUserType =
  | 'anonymous'
  | 'no_subscription'
  | 'active_subscription'
  | 'trial';

export interface LimitedAccessConfig {
  limit_enabled: boolean;
  max_free_audios_per_day: number;
}

export interface FullAccessConfig {
  full_access_enabled: boolean;
}

export interface PaywallPermissions {
  anonymous: LimitedAccessConfig;
  no_subscription: LimitedAccessConfig;
  active_subscription: FullAccessConfig;
  trial: FullAccessConfig;
}

export const DEFAULT_PAYWALL_PERMISSIONS: PaywallPermissions = {
  anonymous: {
    limit_enabled: true,
    // Anônimos (não logados) nunca podem dar play: sempre exige login.
    max_free_audios_per_day: 0,
  },
  no_subscription: {
    limit_enabled: true,
    max_free_audios_per_day: 1,
  },
  active_subscription: {
    full_access_enabled: true,
  },
  trial: {
    full_access_enabled: true,
  },
};

export interface PaywallPlanConfig {
  title: string;
  subtitle: string;
  checkout_url: string;
  footer_text: string;
}

export interface PaywallTestimonial {
  title: string;
  text: string;
  rating: number;
}

export interface PaywallScreenConfig {
  title: string;
  description: string;
  cta_label: string;
  plans: {
    upfront: PaywallPlanConfig;
    installments: PaywallPlanConfig;
  };
  testimonials: PaywallTestimonial[];
}

export const DEFAULT_PAYWALL_SCREEN_CONFIG: PaywallScreenConfig = {
  title: 'Sua conta vem com uma avaliação gratuita de 30 dias!',
  description:
    'Medite com Deus com mais de 5,000 orações guiadas, conteúdo para dormir e muito mais!',
  cta_label: '30 Dias por R$ 0,00',
  plans: {
    upfront: {
      title: 'Pague À Vista',
      subtitle: 'Pagamento anual de R$ 249,90 após a avaliação',
      checkout_url: 'https://clkdmg.site/subscribe/agapefy-plano-anual/1click',
      footer_text: '30 dias de graça, depois R$ 249,90/ano (~R$ 20,82/mês)',
    },
    installments: {
      title: 'Pague em Parcelas',
      subtitle: '12 parcelas de R$ 20,82/mês após a avaliação',
      checkout_url: 'https://clkdmg.site/subscribe/plano-mensal-agapefy/1click',
      footer_text: '30 dias grátis, depois 12 pagamentos por ano de R$ 20,82',
    },
  },
  testimonials: [
    {
      title: 'Exatamente o que eu estava procurando',
      text: 'O Hallow é exatamente o que eu estava procurando! É um aplicativo de meditação fantástico que incorpora a fé perfeitamente!',
      rating: 5,
    },
  ],
};

export function parsePaywallPermissions(raw?: string | null): PaywallPermissions {
  if (!raw) return DEFAULT_PAYWALL_PERMISSIONS;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PAYWALL_PERMISSIONS,
      ...parsed,
    };
  } catch {
    return DEFAULT_PAYWALL_PERMISSIONS;
  }
}

export function parsePaywallScreenConfig(raw?: string | null): PaywallScreenConfig {
  if (!raw) return DEFAULT_PAYWALL_SCREEN_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PAYWALL_SCREEN_CONFIG,
      ...parsed,
      plans: {
        upfront: {
          ...DEFAULT_PAYWALL_SCREEN_CONFIG.plans.upfront,
          ...(parsed.plans?.upfront || {}),
        },
        installments: {
          ...DEFAULT_PAYWALL_SCREEN_CONFIG.plans.installments,
          ...(parsed.plans?.installments || {}),
        },
      },
      testimonials: Array.isArray(parsed.testimonials)
        ? parsed.testimonials
        : DEFAULT_PAYWALL_SCREEN_CONFIG.testimonials,
    };
  } catch {
    return DEFAULT_PAYWALL_SCREEN_CONFIG;
  }
}


