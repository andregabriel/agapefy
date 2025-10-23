import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense fallback={null}>
        <OnboardingClient />
      </Suspense>
    </div>
  );
}


