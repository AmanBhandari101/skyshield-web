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
     No backend on this site, so there is nowhere to POST this to. Composing a mailto:
     link is the honest option: it is exactly as capable as the plain "email us" link in
     Contact, just pre-filled from what was typed. Native form-to-mailto submission
     (action="mailto:...") is inconsistent across browsers, so this is done in script --
     which is also why a plain, always-visible mailto link sits right under the form in
     the markup, for the no-JS case. */
  var partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = function (id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      var name = val('pfName');
      var email = val('pfEmail');
      var phone = val('pfPhone');
      var interest = val('pfInterest');
      var message = val('pfMessage');

      var subject = 'Partner enquiry' + (interest ? ' — ' + interest : '') +
        (name ? ' from ' + name : '');
      var bodyLines = [
        'Name: ' + (name || '(not given)'),
        'Email: ' + (email || '(not given)'),
        'Phone: ' + (phone || '(not given)'),
        'Interested in: ' + (interest || '(not given)'),
        '',
        message || '(no message)'
      ];
      var mailto = 'mailto:aman101bhandari@outlook.com' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(bodyLines.join('\n'));

      var status = document.getElementById('partnerFormStatus');
      if (status) {
        status.textContent = 'Opening your email app with these details filled in — review it there before sending.';
        status.classList.add('show');
      }
      window.location.href = mailto;
    });
  }

  /* ---- demo video ---------------------------------------------------------
     Only reveal the player once the file is confirmed present and readable; a
     missing source would otherwise render an empty black box, which is worse
     than no video section at all. */
  var block = document.getElementById('demoVideoBlock');
  var video = document.getElementById('demoVideo');
  if (block && video) {
    whenReady(video, function () {
      block.hidden = false;
      // The block starts display:none so autoplay may have been skipped while it was not
      // rendered. Ask again now that it is on screen; muted playback is allowed, and a
      // rejected promise here is not an error worth surfacing.
      var p = video.play();
      if (p && typeof p.catch === 'function') { p.catch(function () {}); }
    });
    video.addEventListener('error', function () { block.hidden = true; }, true);
    var src = video.querySelector('source');
    if (src) { src.addEventListener('error', function () { block.hidden = true; }); }
  }
})();
