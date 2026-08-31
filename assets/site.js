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
      '.sechead, .grid, .window, .roadmap, .modindex, .ravin-stage, .dl, .nextnav, .flightslot, .cbox'
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

  /* ---- partner / careers form ---------------------------------------------
     Submits for real now -- the <form> itself posts straight to a Google Form (see the
     action= on the markup), which is what makes an entry land as a spreadsheet row rather
     than an email. Nothing here calls preventDefault(): the native POST is what has to
     fire, so this script only does two things around it -- folds the "Interested in" pick
     into the free-text Details field just before submit (see the markup's own comment for
     why that question can't be posted to directly yet), and shows a confirmation once the
     hidden target iframe finishes loading the cross-origin response, which is the only
     signal available -- the response body itself is unreadable from this origin, so this
     is an honest "it was sent," not a confirmed "it was received." Both the fold and the
     confirmation are enhancements on top of a submission that already works with JS off. */
  var partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', function () {
      var interest = document.getElementById('pfInterest');
      var message = document.getElementById('pfMessage');
      if (interest && message && interest.value) {
        message.value = 'Interested in: ' + interest.value + '\n\n' + message.value;
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
        status.textContent = 'Sent — thanks, we’ll be in touch.';
        status.classList.add('show');
      });
    }
  }

})();
