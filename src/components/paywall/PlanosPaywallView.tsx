"use client";

import { useMemo, useState } from "react";
import { PAYWALL_COLORS } from "./paywall-colors";

export type PaywallPlanId = "promo" | "anual" | "mensal" | "anual-avista" | "familia";

interface PlanosPaywallViewProps {
  onBack: () => void;
  onClose?: () => void;
  onConfirmPlan: (plan: PaywallPlanId) => void;
  fullscreen?: boolean;
}

interface PaywallPlanCard {
  id: PaywallPlanId;
  badge: string | null;
  badgeColor: string;
  name: string;
  priceMain: string;
  priceSuffix: string;
  subtext: string;
}

const plans: PaywallPlanCard[] = [
  {
    id: "promo",
    badge: "PROMOÇÃO",
    badgeColor: PAYWALL_COLORS.red,
    name: "1° Mês",
    priceMain: "1,90",
    priceSuffix: "/1° mês",
    subtext: "Depois R$ 19,90/mês",
  },
  {
    id: "anual",
    badge: null,
    badgeColor: PAYWALL_COLORS.green,
    name: "Anual parcelado em 12x",
    priceMain: "14,90",
    priceSuffix: "/mês",
    subtext: "12x de R$ 14,90 · Economize 25%",
  },
  {
    id: "mensal",
    badge: null,
    badgeColor: PAYWALL_COLORS.goldDark,
    name: "Mensal",
    priceMain: "19,90",
    priceSuffix: "/mês",
    subtext: "Cancele a qualquer momento",
  },
  {
    id: "anual-avista",
    badge: "MAIS ECONÔMICO",
    badgeColor: PAYWALL_COLORS.green,
    name: "Anual à vista",
    priceMain: "149,90",
    priceSuffix: "/ano",
    subtext: "R$ 12,49/mês · Economize 37%",
  },
  {
    id: "familia",
    badge: "ATÉ 4 PESSOAS",
    badgeColor: PAYWALL_COLORS.gold,
    name: "Família Anual",
    priceMain: "249,90",
    priceSuffix: "/ano",
    subtext: "R$ 5,21/mês por pessoa",
  },
];

function PlanosHeader({ onBack, onClose }: { onBack: () => void; onClose?: () => void }) {
  return (
    <>
      <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: PAYWALL_COLORS.warmGray,
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: PAYWALL_COLORS.textMedium,
          }}
        >
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: PAYWALL_COLORS.textDark, margin: 0 }}>
          Escolha seu plano
        </h2>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: PAYWALL_COLORS.warmGray,
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: PAYWALL_COLORS.textMedium,
          }}
        >
          ✕
        </button>
      )}
    </>
  );
}

function PlanosList({
  selected,
  onSelect,
}: {
  selected: PaywallPlanId;
  onSelect: (plan: PaywallPlanId) => void;
}) {
  return (
    <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      {plans.map((plan) => (
        <button
          type="button"
          key={plan.id}
          onClick={() => onSelect(plan.id)}
          style={{
            background: PAYWALL_COLORS.white,
            borderRadius: 16,
            padding: "16px 18px",
            border:
              selected === plan.id
                ? `2.5px solid ${PAYWALL_COLORS.gold}`
                : "2.5px solid transparent",
            boxShadow:
              selected === plan.id
                ? "0 4px 16px rgba(229, 161, 0, 0.15)"
                : "0 1px 4px rgba(0,0,0,0.04)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, paddingRight: 10 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border:
                  selected === plan.id
                    ? `2px solid ${PAYWALL_COLORS.gold}`
                    : `2px solid ${PAYWALL_COLORS.textLight}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected === plan.id && (
                <div style={{ width: 12, height: 12, borderRadius: 6, background: PAYWALL_COLORS.gold }} />
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: PAYWALL_COLORS.textDark, textAlign: "left" }}>
                  {plan.name}
                </span>
                {plan.badge && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: PAYWALL_COLORS.white,
                      background: plan.badgeColor,
                      padding: "2px 7px",
                      borderRadius: 6,
                    }}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: PAYWALL_COLORS.textLight }}>{plan.subtext}</span>
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 12, color: PAYWALL_COLORS.textMedium }}>R$</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: PAYWALL_COLORS.textDark }}>
                {plan.priceMain}
              </span>
            </div>
            <span style={{ fontSize: 10, color: PAYWALL_COLORS.textLight }}>{plan.priceSuffix}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PlanosPaywallView({
  onBack,
  onClose,
  onConfirmPlan,
  fullscreen = false,
}: PlanosPaywallViewProps) {
  const [selected, setSelected] = useState<PaywallPlanId>("promo");

  const ctaText = useMemo(() => {
    if (selected === "promo") return "COMEÇAR POR R$ 1,90";
    if (selected === "anual") return "ASSINAR — 12x DE R$ 14,90";
    if (selected === "mensal") return "ASSINAR MENSAL — R$ 19,90/MÊS";
    if (selected === "anual-avista") return "ASSINAR ANUAL — R$ 149,90";
    return "ASSINAR FAMÍLIA — R$ 249,90/ANO";
  }, [selected]);

  return (
    <div
      style={{
        maxWidth: 390,
        margin: "0 auto",
        minHeight: fullscreen ? "100svh" : undefined,
        background: PAYWALL_COLORS.offWhite,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
      }}
    >
      <PlanosHeader onBack={onBack} onClose={onClose} />

      <PlanosList selected={selected} onSelect={setSelected} />

      <div style={{ padding: "20px 20px 12px" }}>
        <button
          type="button"
          onClick={() => onConfirmPlan(selected)}
          style={{
            width: "100%",
            padding: "18px 24px",
            background: `linear-gradient(135deg, ${PAYWALL_COLORS.gold}, ${PAYWALL_COLORS.goldDark})`,
            border: "none",
            borderRadius: 16,
            color: PAYWALL_COLORS.white,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(229, 161, 0, 0.35)",
          }}
        >
          {ctaText}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: PAYWALL_COLORS.green, fontWeight: 600 }}>
            🔒 Cancele quando quiser · Sem taxa
          </span>
        </div>
      </div>

      <div style={{ padding: "8px 20px" }}>
        <div style={{ background: PAYWALL_COLORS.white, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PAYWALL_COLORS.textDark }}>Garantia sem risco</div>
            <div style={{ fontSize: 12, color: PAYWALL_COLORS.textLight }}>Não gostou? Cancele em 1 toque. Sem perguntas.</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "16px 24px 36px" }}>
        <p style={{ fontSize: 10, color: PAYWALL_COLORS.textLight, marginTop: 12, lineHeight: 1.5 }}>
          Seu plano mensal ou anual renova automaticamente. Se você não quiser continuar, cancele até 24
          horas antes da próxima cobrança. O cancelamento é gratuito, sem multa, e seu acesso
          continua até o fim do período que você já pagou.
        </p>
      </div>
    </div>
  );
}
