/* SkyShield Technology — small progressive enhancements.
   Everything here is additive: with JS off the page reads exactly the same, the counters
   simply show their final values (which are the real text in the markup) and the demo
   video block stays hidden rather than showing an empty player. */
(function () {
  'use strict';

  /* Run fn once the element has at least metadata. A plain loadedmetadata listener is not
     enough: on a repeat visit the file is served from cache and the event can fire before
     this script executes, so the callback would never run and the video would stay hidden
     for good. readyState >= HAVE_METADATA (1) tells us it already happened. */
  function whenReady(el, fn) {
    if (el.readyState >= 1) { fn(); }
    else { el.addEventListener('loadedmetadata', fn); }
  }

  /* ---- mobile menu --------------------------------------------------------
     Only matters below 940px, where the CSS folds the links behind the button. Closes on
     a link tap (which matters for in-page anchors; other links leave the page anyway), on
     Escape, on a tap anywhere outside the header, and when the window widens back past
     the breakpoint -- otherwise it could be left "open" behind a desktop layout that no
     longer shows the button, and reappear open the next time the window narrows. */
  var siteHeader = document.querySelector('header');
  var navToggle = document.querySelector('.nav-toggle');
  if (siteHeader && navToggle) {
    var setMenu = function (open) {
      siteHeader.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    navToggle.addEventListener('click', function () {
      setMenu(!siteHeader.classList.contains('nav-open'));
    });
    Array.prototype.forEach.call(siteHeader.querySelectorAll('nav.links a'), function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && siteHeader.classList.contains('nav-open')) {
        setMenu(false);
        navToggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (siteHeader.classList.contains('nav-open') && !siteHeader.contains(e.target)) { setMenu(false); }
    });
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 941px)');
      var onWide = function () { if (wide.matches) { setMenu(false); } };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }

  /* ---- animated stat counters --------------------------------------------
     Values live in the HTML as real text so they are correct before this runs
     and correct if it never runs; the count-up only replaces them temporarily. */
  var counters = document.querySelectorAll('.stat b[data-count]');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (counters.length && !reduced && 'IntersectionObserver' in window) {
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
      var dur = 1100, t0 = null;

      var step = function (ts) {
        if (t0 === null) { t0 = ts; }
        var p = Math.min((ts - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);          // ease-out, settles rather than stops dead
        el.textContent = (target * eased).toFixed(dec) + suffix;
        if (p < 1) { requestAnimationFrame(step); }
      };
      requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });

    Array.prototype.forEach.call(counters, function (el) { io.observe(el); });
  }

  /* ---- scroll reveal ------------------------------------------------------
     Applied by script rather than sitting in the markup, so a browser without JS
     never ends up with permanently invisible sections. */
  if (!reduced && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll(
      '.sechead, .grid, .window, .roadmap, .modindex, .ravin-stage, .dl, .nextnav, .flightslot, .cbox, .alertshow'
    );
    if (targets.length) {
      var list = Array.prototype.slice.call(targets);
      var revealAll = function () {
        list.forEach(function (el) { el.classList.add('in'); });
      };

      list.forEach(function (el) { el.classList.add('reveal'); });

      var fired = false;
      var ro = new IntersectionObserver(function (entries) {
        fired = true;
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      list.forEach(function (el) { ro.observe(el); });

      // Failsafe. These elements are hidden by CSS and depend on the observer to become
      // visible again, so anything that stops it firing — a background or non-compositing
      // tab, an unusual engine — would otherwise leave the whole page blank below the
      // hero. Confirmed reachable: in a non-compositing tab the observer never fires at
      // all. If nothing has come back by the time this runs, show everything and give up
      // on the effect; a page with no animation beats a page with no content.
      window.setTimeout(function () {
        if (!fired) { ro.disconnect(); revealAll(); }
      }, 1600);

      // Same guarantee for the case where the observer works but the page is restored
      // from bfcache mid-scroll with entries already past.
      window.addEventListener('pageshow', function (e) { if (e.persisted) { revealAll(); } });
    }
  }

  /* ---- Ravin flight footage slot ------------------------------------------
     Unlike the demo capture, this slot is meant to be visibly reserved: if the
     file is not there yet the placeholder stays, and the video only takes over
     once it is confirmed loadable. */
  var slotVideo = document.getElementById('flightVideo');
  var slotPlaceholder = document.getElementById('flightPlaceholder');
  if (slotVideo && slotPlaceholder) {
    var showSlot = function () {
      slotVideo.hidden = false;
      slotPlaceholder.style.display = 'none';
    };
    // whenReady, not a bare listener: on a repeat visit the file comes from cache and
    // loadedmetadata can fire before this script runs, so a listener alone misses it and
    // the video never appears. Check the current state first, then listen.
    whenReady(slotVideo, showSlot);
    var fsrc = slotVideo.querySelector('source');
    if (fsrc) {
      fsrc.addEventListener('error', function () {
        slotVideo.hidden = true;
        slotPlaceholder.style.display = '';
      });
    }
  }

  /* ---- image rotators -------------------------------------------------
     Crossfades between real screenshots stacked in a .rotator, every 3s. The first
     image already has the "active" class in the markup, so with this script never
     running (or reduced motion) the frame just shows that one screenshot, unrotated --
     never an empty frame. */
  var rotators = document.querySelectorAll('.rotator');
  if (rotators.length && !reduced) {
    Array.prototype.forEach.call(rotators, function (rotator) {
      var slides = rotator.querySelectorAll('img');
      if (slides.length < 2) { return; }
      var i = 0;
      window.setInterval(function () {
        slides[i].classList.remove('active');
        i = (i + 1) % slides.length;
        slides[i].classList.add('active');
      }, 3000);
    });
  }

  /* ---- AI alert slideshow -------------------------------------------------
     Deliberately not the generic .rotator above: that one crossfades images only, and this
     block has a caption to keep in step with them, so it needs its own class (.alertstage)
     or the rotator's interval would drive the same slides a second time and fight this one
     for the active class.

     Everything here is additive. The first slide and caption already carry "active" in the
     markup, so with the script absent — or blocked — the block is a single captioned
     screenshot rather than an empty frame.

     Note there are no manual controls by design, which makes the timer the only way to
     reach slides 2-5. So unlike the rotator it keeps running under prefers-reduced-motion,
     where stopping it would strand that visitor on the first alert; the CSS drops the
     crossfade there instead, so the slide cuts over rather than animating. */
  var alertShow = document.getElementById('alertShow');
  if (alertShow) {
    var aSlides = alertShow.querySelectorAll('.alertstage img');
    var aCaps   = alertShow.querySelectorAll('.acap');

    if (aSlides.length > 1) {
      var aIdx = 0, aTimer = null;
      var DWELL = 5000;   // five slides; long enough to actually read the caption

      var aGo = function (n) {
        aIdx = (n + aSlides.length) % aSlides.length;
        for (var i = 0; i < aSlides.length; i++) {
          aSlides[i].classList.toggle('active', i === aIdx);
          if (aCaps[i]) { aCaps[i].classList.toggle('active', i === aIdx); }
        }
      };

      var aStop  = function () { if (aTimer) { window.clearInterval(aTimer); aTimer = null; } };
      var aStart = function () {
        aStop();
        aTimer = window.setInterval(function () { aGo(aIdx + 1); }, DWELL);
      };

      /* A slideshow that moves on while it is being read is worse than none at all, and
         with the dots gone a missed slide costs a full cycle to come back around. Holding
         on hover is now the only way to stay on one, so it matters more than it did. */
      alertShow.addEventListener('mouseenter', aStop);
      alertShow.addEventListener('mouseleave', aStart);

      aStart();
    }
  }

  /* ---- partner / careers form ---------------------------------------------
     Submits for real now -- the <form> itself posts straight to a Google Form (see the
     action= on the markup), which is what makes an entry land as a spreadsheet row rather
     than an email. Nothing here calls preventDefault(): the native POST is what has to
     fire, so this script only does two things around it -- folds the "Interested in" pick
     and some passive context (see briefDevice/submit listener below) into the free-text
     Details field just before submit (see the markup's own comment for why "Interested in"
     can't be posted to directly yet), and shows a confirmation once the hidden target
     iframe finishes loading the cross-origin response, which is the only signal available
     -- the response body itself is unreadable from this origin, so this is an honest "it
     was sent," not a confirmed "it was received." Both the fold and the confirmation are
     enhancements on top of a submission that already works with JS off. */

  /* Coarse, readable OS + browser label from the UA string -- e.g. "Windows · Chrome" --
     rather than dumping the whole raw user-agent string into a spreadsheet cell. Order
     matters: Edge's UA also contains "Chrome/", so Edge has to be checked first. */
  function briefDevice(ua) {
    ua = ua || '';
    var os = 'Unknown OS';
    if (/Windows/.test(ua)) { os = 'Windows'; }
    else if (/Mac OS X/.test(ua)) { os = 'Mac'; }
    else if (/Android/.test(ua)) { os = 'Android'; }
    else if (/iPhone|iPad|iPod/.test(ua)) { os = 'iOS'; }
    else if (/Linux/.test(ua)) { os = 'Linux'; }

    var browser = 'Unknown browser';
    if (/Edg\//.test(ua)) { browser = 'Edge'; }
    else if (/Chrome\//.test(ua)) { browser = 'Chrome'; }
    else if (/Firefox\//.test(ua)) { browser = 'Firefox'; }
    else if (/Safari\//.test(ua)) { browser = 'Safari'; }

    return os + ' · ' + browser;
  }

  /* Pre-select "Interested in" from ?interest= so someone arriving from the rental page's
     CTA does not have to restate why they came. Matched against the option values rather
     than used directly: this value ends up folded into the submitted Details text, so an
     arbitrary query string must never become the text that gets sent. Anything
     unrecognised, or absent, simply leaves the select on its default. */
  var pfInterestEl = document.getElementById('pfInterest');
  if (pfInterestEl && window.URLSearchParams) {
    try {
      var wanted = new URLSearchParams(window.location.search).get('interest');
      if (wanted) {
        for (var oi = 0; oi < pfInterestEl.options.length; oi++) {
          if (pfInterestEl.options[oi].value === wanted) { pfInterestEl.selectedIndex = oi; break; }
        }
      }
    } catch (e) { /* malformed query string -- keep the default selection */ }
  }

  var partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', function () {
      var interest = document.getElementById('pfInterest');
      var message = document.getElementById('pfMessage');

      /* Passive context only -- nothing here needs a permission prompt (no geolocation,
         no camera/mic), so it's all gathered silently and folded into Details, same as
         "Interested in" above and for the same reason: Details is the one field Google
         will actually store whatever text we hand it. Google Forms already timestamps
         every row itself, so a submission time isn't repeated here. */
      var bits = [];
      if (document.referrer) {
        try {
          var refHost = new URL(document.referrer).hostname;
          if (refHost && refHost !== window.location.hostname) { bits.push('via ' + refHost); }
        } catch (e) { /* malformed referrer -- skip it */ }
      }
      bits.push(briefDevice(navigator.userAgent));
      if (navigator.language) { bits.push(navigator.language); }
      try {
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) { bits.push(tz); }
      } catch (e) { /* Intl not available -- skip it */ }

      var context = '\n\n— ' + bits.join(' · ') + ' —';

      if (interest && message && interest.value) {
        message.value = 'Interested in: ' + interest.value + '\n\n' + message.value + context;
      } else if (message) {
        message.value = message.value + context;
      }
    });

    var hiddenFrame = document.getElementById('partnerHiddenFrame');
    var status = document.getElementById('partnerFormStatus');
    if (hiddenFrame && status) {
      var submitted = false;
      partnerForm.addEventListener('submit', function () { submitted = true; });
      hiddenFrame.addEventListener('load', function () {
        // Also fires once for the blank initial load of the iframe itself -- only show the
        // message once an actual submission has gone through it.
        if (!submitted) { return; }
        submitted = false;   // this frame's next load is a fresh submission, not a repeat
        status.textContent = 'Sent — thanks, we’ll be in touch.';
        status.classList.add('show');
        // Clears the visible fields so the page doesn't keep showing what was just sent --
        // without this it looks like nothing happened, since a hidden-iframe submit never
        // navigates the visible page at all. Only done here, after the round trip actually
        // completes, so nothing is lost if it clears while still typing.
        partnerForm.reset();
      });
    }
  }

})();
