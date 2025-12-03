import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense
        fallback={
          <div className="max-w-2xl mx-auto p-4">
            <div className="space-y-4">
              <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
              <div className="h-32 w-full bg-gray-900 border border-gray-800 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-800 rounded ml-auto animate-pulse" />
            </div>
          </div>
        }
      >
        <OnboardingClient />
      </Suspense>
    </div>
  );
}


