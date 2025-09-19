"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Gift, Users, Clock } from 'lucide-react';
import { usePrayerStats } from '@/hooks/usePrayerStats';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PresentModal } from '@/components/modals/PresentModal';
import { toast } from 'sonner';

export function PrayerStatsSection() {
  const { stats, loading } = usePrayerStats();
  const { settings } = useAppSettings();
  const [showPresentModal, setShowPresentModal] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const handleShare = async () => {
    const shareText = 'Receba luz e paz em sua vida através das orações. Venha rezar junto comigo na Agapefy em www.agapefy.com';
    const shareUrl = window.location.origin;
    
    const shareData = {
      title: 'Agapefy - Oração e Meditação Cristã',
      text: shareText,
      url: shareUrl
    };

    try {
      // Tentar usar a Web Share API nativa (funciona no mobile e alguns browsers)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Compartilhado com sucesso!');
        return;
      }
      
      // Fallback: tentar usar a Web Share API sem verificação
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Compartilhado com sucesso!');
        return;
      }
      
      // Se não tiver Web Share API, abrir WhatsApp como fallback
      const whatsappText = encodeURIComponent(shareText);
      const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
      window.open(whatsappUrl, '_blank');
      toast.success('Abrindo WhatsApp para compartilhar!');
      
    } catch (error) {
      // Se o usuário cancelar o compartilhamento
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('Erro ao compartilhar:', error);
      
      // Fallback final: WhatsApp
      try {
        const whatsappText = encodeURIComponent(shareText);
        const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
        window.open(whatsappUrl, '_blank');
        toast.success('Abrindo WhatsApp para compartilhar!');
      } catch (fallbackError) {
        toast.error('Não foi possível compartilhar. Tente novamente.');
      }
    }
  };

  const handlePresentClick = () => {
    setShowPresentModal(true);
  };

  // Verificar se as estatísticas devem ser exibidas
  const showStats = settings.show_prayer_stats === 'true';

  return (
    <>
      {/* Seção principal de estatísticas e presente */}
      <section className="px-4 py-8 text-center space-y-8">
        
        {/* Estatística principal - só exibe se configurado para mostrar */}
        {showStats && (
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                <div className="w-48 h-8 bg-gray-800 rounded animate-pulse mx-auto"></div>
                <div className="w-32 h-6 bg-gray-800 rounded animate-pulse mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-white">
                  <span className="text-green-400">{formatNumber(stats.totalMinutes)}</span> minutos rezados na Agapefy
                </div>
                <div className="text-xl text-gray-300">
                  por <span className="text-green-400 font-semibold">{formatNumber(stats.totalUsers)}</span> pessoas
                </div>
              </>
            )}
          </div>
        )}

        {/* Imagem do presente - com link */}
        <div className="flex justify-center">
          <button
            onClick={handlePresentClick}
            className="w-48 h-48 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center border border-yellow-500/30 hover:from-yellow-500/30 hover:to-orange-500/30 transition-all duration-200 cursor-pointer"
          >
            <Gift size={80} className="text-yellow-400" />
          </button>
        </div>

        {/* Texto motivacional - com link */}
        <div className="space-y-2">
          <button
            onClick={handlePresentClick}
            className="text-lg text-gray-300 max-w-sm mx-auto leading-relaxed hover:text-white transition-colors cursor-pointer"
          >
            Incentive seus amigos à Orar dando de presente um acesso à Agapefy
          </button>
        </div>

        {/* Botão Presentear */}
        <Button
          onClick={handlePresentClick}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold px-8 py-4 rounded-xl text-lg"
        >
          <Gift size={20} className="mr-2" />
          Presentear
        </Button>
      </section>

      {/* Seção de compartilhamento */}
      <section className="px-4 py-6 bg-gray-900/30 rounded-2xl mx-4 border border-gray-800">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">
              Leve luz e paz para seus amigos
            </h3>
            <p className="text-sm text-gray-400">
              Convide-os a rezarem com você na Agapefy
            </p>
          </div>
          
          <Button
            onClick={handleShare}
            variant="outline"
            className="border-blue-500 text-blue-400 hover:bg-blue-500/10 hover:text-white hover:[&_svg]:text-white px-6 py-3"
          >
            <Share2 size={18} className="mr-2" />
            Compartilhar
          </Button>
        </div>
      </section>

      {/* Modal de presente */}
      <PresentModal
        isOpen={showPresentModal}
        onClose={() => setShowPresentModal(false)}
      />
    </>
  );
}