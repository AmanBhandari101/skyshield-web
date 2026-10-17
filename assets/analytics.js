/* SkyShield Technology — visitor analytics.

   Two services, both free, both loaded ONLY after the visitor accepts the cookie notice:
     Google Analytics 4   how many visitors, from where (country, city, which site or search sent them), on what
                          device, which pages, how long, and the actions below as named events.
     Microsoft Clarity    what people actually did: recordings of visits, click and scroll heatmaps, rage clicks.

   Fill in the two IDs below. While an ID is empty that service is simply never loaded, and while both are empty
   no notice is shown at all.

   Actions recorded as events (in Analytics under Reports > Engagement > Events, and as filters in Clarity):
     download        a file download: which file, from which page (GCS installer, manual PDF, pitch PDF, RVT viewer)
     generate_lead   the partner form was sent
     contact         an email, phone or LinkedIn link was clicked
     outbound        any other link leaving the site
   Analytics adds page views, scroll depth and time on page by itself. */
(function () {
  'use strict';

  var CF_TOKEN = '726e0f287bca477f9fe0718c2bf687eb';  // e.g. '1a2b3c4d5e6f...'  (Cloudflare > Web Analytics > this site > the data-cf-beacon token)
  var GA4_ID = '';        // e.g. 'G-ABC123XYZ9'  (Analytics > Admin > Data streams > the web stream > Measurement ID)
  var CLARITY_ID = '';    // e.g. 'abcd1234ef'    (Clarity > the project > Settings > Overview > Project ID)

  var KEY = 'skyshield-consent';           // 'yes' or 'no', remembered in this browser

  /* ---- Cloudflare Web Analytics: loaded at once, deliberately OUTSIDE the consent gate ------------------
     It sets no cookie and writes nothing to the visitor's device, so it needs no consent, and that is the
     whole point of having it: everything behind the notice below only ever counts the visitors who press
     Accept, while this counts all of them.

     The site is on GitHub Pages and its DNS records are grey-clouded, so traffic never passes through
     Cloudflare's edge and the automatic server-side version cannot see it. This beacon is the only way
     Cloudflare gets the data.

     What it does NOT provide: no session recordings, no heatmaps, no custom events - so the download,
     contact and partner-form tracking below never reaches it. Pageviews, referrers, countries, devices and
     core web vitals only. Clarity is what answers "what did they actually do on the page". */
  if (CF_TOKEN) {
    var cf = document.createElement('script');
    cf.defer = true;
    cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    cf.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
    (document.head || document.documentElement).appendChild(cf);
  }

  // Nothing that sets a cookie is configured, so there is nothing to ask about and no notice is shown.
  if (!GA4_ID && !CLARITY_ID) { return; }

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private window: ask again next time */ } }

  /* ---- loading the services ------------------------------------------------------------------------------ */
  var started = false;
  function start() {
    if (started) { return; }
    started = true;
    if (GA4_ID) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
      var g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
      document.head.appendChild(g);
    }
    if (CLARITY_ID) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_ID);
    }
  }

  /* ---- events -------------------------------------------------------------------------------------------- */
  function track(name, params) {
    if (!started) { return; }
    if (window.gtag) { window.gtag('event', name, params || {}); }
    if (window.clarity) { window.clarity('event', name); }
  }
  window.skyshieldTrack = track;            // for anything a page wants to record by hand

  var FILE = /\.(exe|zip|pdf|msi|dmg|apk|stl|step)(\?|#|$)/i;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) { return; }
    var href = a.getAttribute('href') || '';
    var page = location.pathname.replace(/^\//, '') || 'index.html';
    if (/^mailto:/i.test(href)) { track('contact', { method: 'email', page: page }); return; }
    if (/^tel:/i.test(href)) { track('contact', { method: 'phone', page: page }); return; }
    var url;
    try { url = new URL(href, location.href); } catch (err) { return; }
    if (FILE.test(url.pathname)) {
      track('download', { file_name: url.pathname.split('/').pop(), page: page, link_text: (a.textContent || '').trim().slice(0, 80) });
      return;
    }
    if (url.hostname && url.hostname !== location.hostname) {
      if (/linkedin\.com$/i.test(url.hostname)) { track('contact', { method: 'linkedin', page: page }); return; }
      track('outbound', { link_url: url.href.slice(0, 200), page: page });
    }
  }, true);

  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'partnerForm') { track('generate_lead', { form: 'partner', page: location.pathname }); }
  }, true);

  /* ---- the notice ---------------------------------------------------------------------------------------- */
  function notice() {
    var box = document.createElement('div');
    box.className = 'consent';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Cookie notice');
    box.innerHTML =
      '<p>We use cookies to count visitors and see how the site is used, so we can improve it. ' +
      'Nothing is shared for advertising. <a href="privacy.html">Details</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="btn btn-ghost" data-consent="no">Decline</button>' +
      '<button type="button" class="btn btn-primary" data-consent="yes">Accept</button></div>';
    box.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-consent');
      if (!v) { return; }
      store(v);
      box.remove();
      if (v === 'yes') { start(); }
    });
    document.body.appendChild(box);
  }

  /* privacy.html has a button to change one's mind */
  window.skyshieldConsent = function (v) {
    store(v);
    if (v === 'yes') { start(); } else { location.reload(); }
  };

  var choice = stored();
  if (choice === 'yes') { start(); }
  else if (choice !== 'no') {
    if (document.body) { notice(); } else { document.addEventListener('DOMContentLoaded', notice); }
  }
})();
