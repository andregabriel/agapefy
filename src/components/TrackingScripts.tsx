import Script from 'next/script';

function parseEnabled(flag: string | undefined, isProd: boolean) {
  if (typeof flag !== 'string') return isProd;
  const v = flag.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

// Server-rendered tracking scripts (placed in <head> via src/app/layout.tsx).
// This avoids relying on hydration, which can make Hotjar "Verify installation" fail.
export function TrackingScripts() {
  const isProd = process.env.NODE_ENV === 'production';
  const trackingEnabled = parseEnabled(process.env.NEXT_PUBLIC_TRACKING_ENABLED, isProd);

  // Fallback to your current Hotjar Site ID so production doesn't silently ship without tracking
  // if env vars weren't configured in the hosting provider.
  const hotjarIdRaw = process.env.NEXT_PUBLIC_HOTJAR_ID ?? '6615947';
  const hotjarId = Number(hotjarIdRaw);

  if (!trackingEnabled || !Number.isFinite(hotjarId)) return null;
  
  // Google Analytics (gtag.js) - avoid loading on /admin (same behavior as Hotjar).
  const gaMeasurementId = 'G-VE8WTVMR0W';
  const gaSnippet = `(function(){
  try { if (window.location && window.location.pathname && window.location.pathname.indexOf('/admin') === 0) { return; } } catch (e) {}
  var id='${gaMeasurementId}';
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
  var head=document.getElementsByTagName('head')[0];
  if (head) { head.appendChild(s); }
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', id);
})();`;

  // Keep the snippet present in <head> (so Hotjar can detect it), but avoid tracking /admin.
  // Hotjar itself is only initialized when the path is NOT /admin.
  const hotjarSnippet = `(function(){
  try { if (window.location && window.location.pathname && window.location.pathname.indexOf('/admin') === 0) { return; } } catch (e) {}
  (function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjarId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
})();`;

  return (
    <>
      <Script id="google-gtag" strategy="beforeInteractive">
        {gaSnippet}
      </Script>
      <Script id="hotjar" strategy="beforeInteractive">
        {hotjarSnippet}
      </Script>
    </>
  );
}
