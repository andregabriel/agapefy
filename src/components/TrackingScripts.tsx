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

  // TikTok Pixel - placed in <head> and avoided on /admin (same behavior as GA/Hotjar).
  const tiktokPixelId = (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? 'D5NSLQBC77U0089IST1G').trim();
  const tiktokSnippet = `(function(){
  try { if (window.location && window.location.pathname && window.location.pathname.indexOf('/admin') === 0) { return; } } catch (e) {}
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
  var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
  ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    ttq.load('${tiktokPixelId}');
    ttq.page();
  }(window, document, 'ttq');
})();`;

  return (
    <>
      <Script id="google-gtag" strategy="beforeInteractive">
        {gaSnippet}
      </Script>
      <Script id="hotjar" strategy="beforeInteractive">
        {hotjarSnippet}
      </Script>
      <Script id="tiktok-pixel" strategy="beforeInteractive">
        {tiktokSnippet}
      </Script>
    </>
  );
}
