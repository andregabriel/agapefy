"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  parsePaywallCheckoutLinks,
  type PaywallCheckoutLinks,
} from "@/constants/paywall";
import { useAppSettings } from "@/hooks/useAppSettings";
import { OfertaPaywallView } from "./OfertaPaywallView";
import { PlanosPaywallView, type PaywallPlanId } from "./PlanosPaywallView";

type PaywallView = "offer" | "plans";

interface PaywallShowcaseProps {
  variant?: "modal" | "inline";
  onClose?: () => void;
}

const PLAN_TO_LINK_KEY: Record<PaywallPlanId, keyof PaywallCheckoutLinks> = {
  promo: "promo",
  anual: "anual",
  mensal: "mensal",
  "anual-avista": "anual_avista",
  familia: "familia",
};

export function PaywallShowcase({ variant = "modal", onClose }: PaywallShowcaseProps) {
  const { settings } = useAppSettings();
  const [view, setView] = useState<PaywallView>("offer");

  const checkoutLinks = useMemo(
    () => parsePaywallCheckoutLinks(settings.paywall_checkout_links),
    [settings.paywall_checkout_links],
  );

  const redirectToCheckout = (url: string) => {
    if (!url || !url.trim()) {
      toast.error("URL de checkout não configurada para este plano.");
      return;
    }

    try {
      window.location.href = url;
    } catch {
      toast.error("Não foi possível abrir a página de pagamento.");
    }
  };

  const handleConfirmPlan = (planId: PaywallPlanId) => {
    const linkKey = PLAN_TO_LINK_KEY[planId];
    redirectToCheckout(checkoutLinks[linkKey]);
  };

  const isFullscreen = variant === "modal";

  return (
    <div>
      {view === "offer" ? (
        <OfertaPaywallView
          onClose={onClose}
          onPrimaryAction={() => redirectToCheckout(checkoutLinks.offer_cta)}
          onSeeAllPlans={() => setView("plans")}
          fullscreen={isFullscreen}
        />
      ) : (
        <PlanosPaywallView
          onBack={() => setView("offer")}
          onClose={onClose}
          onConfirmPlan={handleConfirmPlan}
          fullscreen={isFullscreen}
        />
      )}
    </div>
  );
}
