"use client";

import { PAYWALL_COLORS } from "./paywall-colors";
import { useAppSettings } from "@/hooks/useAppSettings";

interface OfertaPaywallViewProps {
  onClose?: () => void;
  onPrimaryAction: () => void;
  onSeeAllPlans: () => void;
  fullscreen?: boolean;
}

const testimonials = [
  {
    name: "Júlio Rodrigues",
    text: "Irmão, muito obrigado por esse app e aprendizado com você, tive uma briga com minha namorada estávamos para terminar, orei ouvi a oração e estava orando conversando com Deus e tudo está se acertando Graças a Deus... tenho certeza que o app será transformador na vida de muita gente 🙌 🙏",
  },
];

const benefits = [
  { icon: "📖", text: "Devocional novo todo dia", sub: "para começar seu dia com Deus" },
  { icon: "🎯", text: "Devocionais por propósito", sub: "ansiedade, finanças, luto, casamento..." },
  { icon: "💬", text: "Tire dúvidas da Bíblia", sub: "chat inteligente 24h" },
  { icon: "📲", text: "Devocional no seu WhatsApp", sub: "leia onde for mais fácil pra você" },
];

function OfertaHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{ padding: "40px 24px 48px", textAlign: "center", position: "relative" }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.6)",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      )}

      <h1
        style={{
          color: PAYWALL_COLORS.white,
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.2,
          margin: "0 0 12px",
        }}
      >
        Comece cada dia
        <br />
        mais perto de Deus
      </h1>
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.5, margin: 0 }}>
        Devocionais que transformam sua vida espiritual.
      </p>

    </div>
  );
}

function OfertaCard() {
  return (
    <div style={{ padding: "0 20px", marginTop: -24 }}>
      <div
        style={{
          background: PAYWALL_COLORS.white,
          borderRadius: 20,
          padding: "28px 24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: PAYWALL_COLORS.red,
            color: PAYWALL_COLORS.white,
            fontSize: 11,
            fontWeight: 800,
            padding: "6px 14px 6px 18px",
            borderRadius: "0 20px 0 16px",
          }}
        >
          PROMOÇÃO
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", marginBottom: 4 }}>
            <span style={{ color: PAYWALL_COLORS.green, fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
              R$ 1,90
            </span>
          </div>
          <p style={{ color: PAYWALL_COLORS.textMedium, fontSize: 13, margin: "4px 0 0" }}>
            no primeiro mês · depois R$ 19,90/mês
          </p>
        </div>

        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAYWALL_COLORS.warmGray}, transparent)`, margin: "0 0 20px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {benefits.map((item) => (
            <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1.2 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: PAYWALL_COLORS.textDark }}>{item.text}</div>
                <div style={{ fontSize: 12, color: PAYWALL_COLORS.textLight, marginTop: 2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function OfertaSocialProof({ showRatingsBadge }: { showRatingsBadge: boolean }) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      {showRatingsBadge && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: PAYWALL_COLORS.greenLight,
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            <span style={{ fontSize: 13 }}>⭐</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: PAYWALL_COLORS.green }}>4.8 ESTRELAS · +50 MIL DOWNLOADS</span>
          </div>
        </div>
      )}

      <div style={{ background: PAYWALL_COLORS.white, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} style={{ color: PAYWALL_COLORS.gold, fontSize: 14 }}>★</span>
          ))}
        </div>
        <p style={{ fontSize: 14, color: PAYWALL_COLORS.textDark, lineHeight: 1.5, margin: "0 0 8px", fontStyle: "italic" }}>
          "{testimonials[0].text}"
        </p>
        <span style={{ fontSize: 12, color: PAYWALL_COLORS.textLight, fontWeight: 600 }}>— {testimonials[0].name}</span>
      </div>
    </div>
  );
}

export function OfertaPaywallView({
  onClose,
  onPrimaryAction,
  onSeeAllPlans,
  fullscreen = false,
}: OfertaPaywallViewProps) {
  const { settings } = useAppSettings();
  const showRatingsBadge = settings.paywall_show_ratings_badge === "true";

  return (
    <div
      style={{
        maxWidth: 390,
        margin: "0 auto",
        minHeight: fullscreen ? "100svh" : undefined,
        background: `linear-gradient(180deg, ${PAYWALL_COLORS.dark} 0%, ${PAYWALL_COLORS.darkSoft} 42%, ${PAYWALL_COLORS.offWhite} 42%)`,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden",
      }}
    >
      <OfertaHeader onClose={onClose} />
      <OfertaCard />

      <div style={{ padding: "24px 20px 12px" }}>
        <button
          type="button"
          onClick={onPrimaryAction}
          style={{
            width: "100%",
            padding: "18px 24px",
            background: `linear-gradient(135deg, ${PAYWALL_COLORS.gold}, ${PAYWALL_COLORS.goldDark})`,
            border: "none",
            borderRadius: 16,
            color: PAYWALL_COLORS.white,
            fontSize: 17,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(229, 161, 0, 0.4)",
          }}
        >
          COMEÇAR POR R$ 1,90 →
        </button>

        <div style={{ textAlign: "center", marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: PAYWALL_COLORS.green, fontWeight: 600 }}>🔒 Cancele quando quiser</span>
          <span style={{ fontSize: 11, color: PAYWALL_COLORS.textLight }}>Sem compromisso.</span>
        </div>
      </div>

      <OfertaSocialProof showRatingsBadge={showRatingsBadge} />

      <div style={{ textAlign: "center", padding: "20px 20px 36px" }}>
        <button
          type="button"
          onClick={onSeeAllPlans}
          style={{ fontSize: 13, color: PAYWALL_COLORS.textMedium, textDecoration: "underline", border: "none", background: "transparent", cursor: "pointer" }}
        >
          Ver todos os planos
        </button>
      </div>
    </div>
  );
}
