'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const trackingFlag = process.env.NEXT_PUBLIC_TRACKING_ENABLED;
const trackingEnabled =
  typeof trackingFlag === 'string' ? trackingFlag === 'true' : process.env.NODE_ENV === 'production';
const hotjarId = Number(process.env.NEXT_PUBLIC_HOTJAR_ID);

export function TrackingScripts() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    if (isAdminRoute || !trackingEnabled || !Number.isFinite(hotjarId)) {
      return;
    }

    const scriptId = 'hotjar-script';
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.innerHTML = `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjarId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`;
    document.head.appendChild(script);
  }, [isAdminRoute]);

  return null;
}
