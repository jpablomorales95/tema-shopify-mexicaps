/* ============================================
   DRIFT Theme by WEBEXP, LLC
   DRIFT Collection — View Toggle (Feed ↔ Grid)
   + Resume scroll position from URL param
   + Grid blur-up image loader
   https://webexp.dev
   ============================================ */

(function () {
  var section = document.querySelector('[data-section-type="drift-collection"]');
  if (!section) return;

  var defaultView = section.getAttribute('data-default-view') || 'feed';
  var allowToggle = section.getAttribute('data-allow-toggle') === 'true';
  var toggleBtn = document.querySelector('[data-view-toggle]');
  var feedEl = section.querySelector('[data-collection-view="feed"]');
  var gridEl = section.querySelector('[data-collection-view="grid"]');
  var currentView = defaultView;
  var gridLoaded = false;

  /* ── Hide toggle if not allowed ── */
  if (!allowToggle && toggleBtn) {
    toggleBtn.style.display = 'none';
  }

  /* ── Set initial state on html element ── */
  document.documentElement.setAttribute('data-view-mode', currentView);

  /* ── Check for feed_index param to resume position ── */
  var params = new URLSearchParams(window.location.search);
  var resumeIndex = params.get('feed_index');

  if (resumeIndex !== null && feedEl) {
    resumeIndex = parseInt(resumeIndex, 10);

    /* Hide feed track immediately to prevent flash of slide 0 */
    var track = feedEl.querySelector('[data-feed-track]');
    if (track) {
      track.style.opacity = '0';
    }

    var checkReady = setInterval(function () {
      if (track && track.classList.contains('is-ready')) {
        clearInterval(checkReady);

        var slides = track.querySelectorAll('[data-feed-slide]');
        if (resumeIndex >= 0 && resumeIndex < slides.length) {
          var slide = slides[resumeIndex];
          var slideCenter = slide.offsetTop + slide.offsetHeight * 0.5;
          var targetScroll = slideCenter - track.offsetHeight * 0.5;

          /* Kill snap temporarily for instant jump */
          track.style.scrollSnapType = 'none';
          track.scrollTop = Math.max(0, targetScroll);

          /* Re-enable snap + reveal after paint */
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              track.style.scrollSnapType = '';
              track.style.opacity = '';
              /* Trigger transforms + active state */
              track.dispatchEvent(new Event('scroll'));
            });
          });
        } else {
          /* Invalid index — just reveal */
          track.style.opacity = '';
        }
      }
    }, 50);

    /* Safety: reveal after 3 seconds no matter what */
    setTimeout(function () {
      clearInterval(checkReady);
      if (track) track.style.opacity = '';
    }, 3000);
  }

  /* ── Grid blur-up image loader ── */
  function loadGridImages() {
    var imgs = section.querySelectorAll('.drift-collection__grid-img[data-src]');
    imgs.forEach(function (img) {
      var full = new Image();
      full.onload = function () {
        img.src = img.dataset.src;
        if (img.dataset.srcset) {
          img.srcset = img.dataset.srcset;
        }
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
        img.classList.add('is-loaded');
      };
      full.src = img.dataset.src;
    });
  }

  /* ── Switch views ── */
  function setView(view) {
    if (view === currentView) return;
    currentView = view;

    section.setAttribute('data-view-mode', view);
    document.documentElement.setAttribute('data-view-mode', view);

    if (view === 'feed') {
      gridEl.hidden = true;
      feedEl.hidden = false;

      /* Re-init feed — recalc spacers + transforms */
      var t = feedEl.querySelector('[data-feed-track]');
      if (t) {
        t.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
      }

      if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to grid view');
    } else {
      feedEl.hidden = true;
      gridEl.hidden = false;

      /* Load grid images on first switch */
      if (!gridLoaded) {
        gridLoaded = true;
        loadGridImages();
      }

      /* Scroll grid to top */
      gridEl.scrollTop = 0;

      if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to feed view');
    }
  }

  /* ── Load grid images immediately if grid is default view ── */
  if (defaultView === 'grid') {
    gridLoaded = true;
    loadGridImages();
  }

  /* ── Toggle button click ── */
  if (toggleBtn && allowToggle) {
    toggleBtn.addEventListener('click', function () {
      setView(currentView === 'feed' ? 'grid' : 'feed');
    });
  }

  /* ── Keyboard shortcut: V to toggle view ── */
  if (allowToggle) {
    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setView(currentView === 'feed' ? 'grid' : 'feed');
      }
    });
  }

  /* ── Init — set correct aria label ── */
  if (toggleBtn) {
    toggleBtn.setAttribute(
      'aria-label',
      currentView === 'feed' ? 'Switch to grid view' : 'Switch to feed view'
    );
  }
})();