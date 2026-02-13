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

export interface PaywallCheckoutLinks {
  offer_cta: string;
  promo: string;
  anual: string;
  mensal: string;
  anual_avista: string;
  familia: string;
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

export const DEFAULT_PAYWALL_CHECKOUT_LINKS: PaywallCheckoutLinks = {
  offer_cta: 'https://clkdmg.site/subscribe/plano-mensal-agapefy/1click',
  promo: 'https://clkdmg.site/subscribe/plano-mensal-agapefy/1click',
  anual: 'https://clkdmg.site/subscribe/agapefy-plano-anual/1click',
  mensal: 'https://clkdmg.site/subscribe/plano-mensal-agapefy/1click',
  anual_avista: 'https://clkdmg.site/subscribe/agapefy-plano-anual/1click',
  familia: 'https://clkdmg.site/subscribe/agapefy-plano-anual/1click',
};

function normalizeLimitedAccessConfig(
  raw: any,
  fallback: LimitedAccessConfig,
): LimitedAccessConfig {
  const limitEnabled =
    typeof raw?.limit_enabled === 'boolean' ? raw.limit_enabled : fallback.limit_enabled;
  const rawMax = raw?.max_free_audios_per_day;
  const parsedMax = rawMax == null ? NaN : Number(rawMax);
  const maxFreePerDay = Number.isFinite(parsedMax)
    ? parsedMax
    : fallback.max_free_audios_per_day;

  return {
    limit_enabled: limitEnabled,
    max_free_audios_per_day: maxFreePerDay,
  };
}

function normalizeFullAccessConfig(
  raw: any,
  fallback: FullAccessConfig,
): FullAccessConfig {
  return {
    full_access_enabled:
      typeof raw?.full_access_enabled === 'boolean'
        ? raw.full_access_enabled
        : fallback.full_access_enabled,
  };
}

export function parsePaywallPermissions(raw?: string | null): PaywallPermissions {
  if (!raw) return DEFAULT_PAYWALL_PERMISSIONS;
  try {
    const parsed = JSON.parse(raw);
    return {
      anonymous: normalizeLimitedAccessConfig(parsed?.anonymous, DEFAULT_PAYWALL_PERMISSIONS.anonymous),
      no_subscription: normalizeLimitedAccessConfig(
        parsed?.no_subscription,
        DEFAULT_PAYWALL_PERMISSIONS.no_subscription,
      ),
      active_subscription: normalizeFullAccessConfig(
        parsed?.active_subscription,
        DEFAULT_PAYWALL_PERMISSIONS.active_subscription,
      ),
      trial: normalizeFullAccessConfig(parsed?.trial, DEFAULT_PAYWALL_PERMISSIONS.trial),
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

function normalizeCheckoutUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  return raw.trim();
}

export function parsePaywallCheckoutLinks(raw?: string | null): PaywallCheckoutLinks {
  if (!raw) return DEFAULT_PAYWALL_CHECKOUT_LINKS;
  try {
    const parsed = JSON.parse(raw);
    return {
      offer_cta: normalizeCheckoutUrl(
        parsed?.offer_cta,
        DEFAULT_PAYWALL_CHECKOUT_LINKS.offer_cta,
      ),
      promo: normalizeCheckoutUrl(parsed?.promo, DEFAULT_PAYWALL_CHECKOUT_LINKS.promo),
      anual: normalizeCheckoutUrl(parsed?.anual, DEFAULT_PAYWALL_CHECKOUT_LINKS.anual),
      mensal: normalizeCheckoutUrl(parsed?.mensal, DEFAULT_PAYWALL_CHECKOUT_LINKS.mensal),
      anual_avista: normalizeCheckoutUrl(
        parsed?.anual_avista,
        DEFAULT_PAYWALL_CHECKOUT_LINKS.anual_avista,
      ),
      familia: normalizeCheckoutUrl(
        parsed?.familia,
        DEFAULT_PAYWALL_CHECKOUT_LINKS.familia,
      ),
    };
  } catch {
    return DEFAULT_PAYWALL_CHECKOUT_LINKS;
  }
}
