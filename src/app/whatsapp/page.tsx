"use client";

import WhatsAppSetup from "@/components/whatsapp/WhatsAppSetup";

export default function WhatsAppSetupPage() {
  // Permitir que usuários convidados acessem a página de WhatsApp sem serem redirecionados para login.
  // A lógica interna do componente ainda exige login para salvar o número, mas a visualização é liberada.
  return <WhatsAppSetup variant="standalone" redirectIfNotLoggedIn={false} />;
}


