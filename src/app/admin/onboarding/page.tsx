"use client";

import OnboardingTimeline from '@/components/admin/onboarding/OnboardingTimeline';
import AdminHamburgerMenu from '@/components/admin/AdminHamburgerMenu';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <AdminHamburgerMenu />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerenciar Onboarding</h1>
                <p className="text-sm text-gray-500 mt-1">Visualize e edite todas as telas do fluxo de onboarding</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OnboardingTimeline />
      </div>
    </div>
  );
}

