(function () {
  var GA_MEASUREMENT_ID = 'G-K0GYWYM0KY';
  var STORAGE_KEY = 'klavio_cookie_consent';

  function loadAnalytics() {
    if (window.__klavioAnalyticsLoaded) return;
    window.__klavioAnalyticsLoaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  }

  function hideBanner() {
    var el = document.getElementById('klavioCookieBanner');
    if (el) el.remove();
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '#klavioCookieBanner{position:fixed;left:0;right:0;bottom:0;z-index:2000;background:#0a0f1e;border-top:1px solid rgba(255,255,255,0.1);padding:18px 24px;font-family:"Inter",system-ui,sans-serif;}' +
      '#klavioCookieBanner .kcb-inner{max-width:1160px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}' +
      '#klavioCookieBanner p{color:rgba(255,255,255,0.65);font-size:0.88rem;line-height:1.5;margin:0;flex:1;min-width:240px;}' +
      '#klavioCookieBanner a{color:#60a5fa;text-decoration:underline;}' +
      '#klavioCookieBanner .kcb-actions{display:flex;gap:10px;flex-shrink:0;}' +
      '#klavioCookieBanner .kcb-btn{border-radius:8px;padding:10px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;white-space:nowrap;}' +
      '#klavioCookieBanner .kcb-decline{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.75);}' +
      '#klavioCookieBanner .kcb-accept{background:#2563eb;color:#fff;}' +
      '@media(max-width:560px){#klavioCookieBanner .kcb-inner{flex-direction:column;align-items:stretch;}#klavioCookieBanner .kcb-actions{justify-content:stretch;}#klavioCookieBanner .kcb-btn{flex:1;}}';
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();
    var banner = document.createElement('div');
    banner.id = 'klavioCookieBanner';
    banner.innerHTML =
      '<div class="kcb-inner">' +
        '<p>Koristimo kolačiće za analizu posjeta i poboljšanje platforme. Detalje možete pročitati u našoj <a href="/cookies.html">Politici kolačića</a>.</p>' +
        '<div class="kcb-actions">' +
          '<button type="button" class="kcb-btn kcb-decline">Odbij</button>' +
          '<button type="button" class="kcb-btn kcb-accept">Prihvati</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    banner.querySelector('.kcb-accept').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      loadAnalytics();
      hideBanner();
    });
    banner.querySelector('.kcb-decline').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'declined');
      hideBanner();
    });
  }

  var consent = localStorage.getItem(STORAGE_KEY);
  if (consent === 'accepted') {
    loadAnalytics();
  } else if (consent !== 'declined') {
    showBanner();
  }

  window.klavioTrack = function (eventName, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params || {});
    }
  };
})();
