'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const trackingEnabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === 'true';
const hotjarId = Number(process.env.NEXT_PUBLIC_HOTJAR_ID);

export function TrackingScripts() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute || !trackingEnabled || !Number.isFinite(hotjarId)) {
    return null;
  }

  return (
    <>
      <Script id="hotjar" strategy="afterInteractive">
        {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjarId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
      </Script>
    </>
  );
}
