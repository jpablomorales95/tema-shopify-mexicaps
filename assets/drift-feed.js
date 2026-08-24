/* ============================================
   DRIFT Theme by WEBEXP, LLC
   DRIFT Feed — Scroll Transitions + Rubber Band Loop
   https://webexp.dev
   ============================================ */

(function () {
  /* FEATURE-002: dual-render section.
     - section = outer wrapper with data-section-type="drift-feed"
     - feedEl  = swipe view block (.drift-feed)
     - gridEl  = grid view block (.drift-collection__grid-wrap)
     One has the `hidden` attribute on initial render based on the
     merchant's Default view setting; localStorage can override. */
  var section = document.querySelector('[data-section-type="drift-feed"]');
  if (!section) return;
  /* BUG: drift-collection.liquid loads drift-feed.js to handle its own
     swipe transforms. Collection's feed block IS the [data-section-type]
     element (no inner [data-feed-view="swipe"] child), so fall back to
     `section` itself when the inner block is absent. This keeps Collection's
     feed view working while the new dual-render Product Feed structure
     still gets its inner swipe block. */
  var feed = section.querySelector('[data-feed-view="swipe"]') || section;
  var gridEl = section.querySelector('[data-feed-view="grid"]');

  var allowToggle = section.getAttribute('data-allow-toggle') === 'true';
  var defaultView = section.getAttribute('data-default-view') || 'swipe';
  var savedView = null;
  try { savedView = localStorage.getItem('drift-feed-view'); } catch (e) {}
  var initialView = (allowToggle && gridEl && (savedView === 'swipe' || savedView === 'grid'))
    ? savedView
    : defaultView;
  if (initialView !== defaultView) {
    if (initialView === 'grid' && gridEl) {
      feed.hidden = true;
      gridEl.hidden = false;
    } else if (initialView === 'swipe') {
      feed.hidden = false;
      if (gridEl) gridEl.hidden = true;
    }
  }
  section.setAttribute('data-view-mode', initialView);
  document.documentElement.setAttribute('data-view-mode', initialView);

  var track = feed.querySelector('[data-feed-track]');
  if (!track) return;
  var slides = track.querySelectorAll('[data-feed-slide]');
  if (slides.length === 0) return;

  var SCALE_MIN = 0.7;
  var SCALE_MAX = 1;
  var BLUR_MAX = 6;
  var OPACITY_MIN = 0.3;

  var spacerTop = track.querySelector('[data-feed-spacer="top"]');
  var spacerBottom = track.querySelector('[data-feed-spacer="bottom"]');
  var currentIndex = -1;
  var isLooping = false;
  var counterEl = feed.querySelector('[data-feed-current]');
  var dots = feed.querySelectorAll('[data-feed-dot]');

  var params = new URLSearchParams(window.location.search);
  var resumeIndex = params.has('feed_index') ? parseInt(params.get('feed_index'), 10) : -1;
  var hasResume = resumeIndex >= 0 && resumeIndex < slides.length;

  function setPadding() {
    var trackH = track.offsetHeight;
    var slideH = slides[0] ? slides[0].offsetHeight : 0;
    var pad = Math.max((trackH - slideH) / 2, 0);
    if (spacerTop) spacerTop.style.height = pad + 'px';
    if (spacerBottom) spacerBottom.style.height = pad + 'px';
  }

  function setActive(index) {
    if (index === currentIndex) return;
    if (currentIndex >= 0 && currentIndex < slides.length) {
      slides[currentIndex].classList.remove('is-active');
      if (dots[currentIndex]) dots[currentIndex].classList.remove('is-active');
    }
    currentIndex = index;
    slides[currentIndex].classList.add('is-active');
    if (dots[currentIndex]) dots[currentIndex].classList.add('is-active');
    if (counterEl) {
      var display = currentIndex + 1;
      counterEl.textContent = slides.length >= 10 && display < 10 ? '0' + display : '' + display;
    }
  }

  function getVisibleIndex() {
    var viewCenter = track.scrollTop + track.offsetHeight * 0.5;
    var closest = 0;
    var minDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var center = slides[i].offsetTop + slides[i].offsetHeight * 0.5;
      var d = Math.abs(center - viewCenter);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }

  function applyTransforms() {
    var trackH = track.offsetHeight;
    var scrollTop = track.scrollTop;
    var viewCenter = scrollTop + trackH * 0.5;

    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      var img = slide.querySelector('.drift-feed__image');
      if (!img) continue;

      var slideH = slide.offsetHeight;
      var slideCenter = slide.offsetTop + slideH * 0.5;
      var dist = Math.abs(slideCenter - viewCenter);
      var progress = Math.min(dist / slideH, 1);

      var scale = SCALE_MAX - progress * (SCALE_MAX - SCALE_MIN);
      var blur = progress * BLUR_MAX;
      var opacity = 1 - progress * (1 - OPACITY_MIN);

     if (slide.classList.contains('is-sold-out')) {
  img.style.transform = 'scale(' + scale + ')';
  img.style.filter = 'blur(4px)';
  img.style.opacity = 0.35;
  var soldBadge = slide.querySelector('.drift-badge-stack');
  if (soldBadge) soldBadge.style.opacity = 0.35;
  continue;
}

   img.style.transform = 'scale(' + scale + ')';
img.style.opacity = opacity;

if (blur > 1) {
  img.style.filter = 'blur(' + blur + 'px)';
} else {
  img.style.removeProperty('filter');
}

var badge = slide.querySelector('.drift-badge-stack');
if (badge) badge.style.opacity = opacity;
    }
  }

  var lastScroll = -1;

  function frameLoop() {
    var st = track.scrollTop;
    if (st !== lastScroll) {
      lastScroll = st;
      applyTransforms();
      setActive(getVisibleIndex());
    }
    requestAnimationFrame(frameLoop);
  }

  var settledOnBoundary = false;
  var settleTimer;

  track.addEventListener('scroll', function () {
    settledOnBoundary = false;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (isLooping) return;
      var maxScroll = track.scrollHeight - track.offsetHeight;
      var atBottom = track.scrollTop >= maxScroll - 2;
      var atTop = track.scrollTop <= 2;
      var idx = getVisibleIndex();
      if ((atBottom && idx === slides.length - 1) || (atTop && idx === 0)) {
        settledOnBoundary = true;
      }
    }, 400);
  }, { passive: true });

  track.addEventListener('wheel', function (e) {
    if (isLooping || !settledOnBoundary) return;
    var maxScroll = track.scrollHeight - track.offsetHeight;
    var atBottom = track.scrollTop >= maxScroll - 2;
    var atTop = track.scrollTop <= 2;
    var idx = getVisibleIndex();
    if (atBottom && idx === slides.length - 1 && e.deltaY > 0) {
      settledOnBoundary = false;
      isLooping = true;
      scrollToIndex(0);
      setTimeout(function () { isLooping = false; }, 1000);
    }
    if (atTop && idx === 0 && e.deltaY < 0) {
      settledOnBoundary = false;
      isLooping = true;
      scrollToIndex(slides.length - 1);
      setTimeout(function () { isLooping = false; }, 1000);
    }
  }, { passive: true });

  var touchStartY = 0;

  track.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  track.addEventListener('touchend', function (e) {
    if (isLooping || !settledOnBoundary) return;
    var touchEndY = e.changedTouches[0].clientY;
    var diff = touchStartY - touchEndY;
    var maxScroll = track.scrollHeight - track.offsetHeight;
    var atBottom = track.scrollTop >= maxScroll - 2;
    var atTop = track.scrollTop <= 2;
    var idx = getVisibleIndex();
    if (atBottom && idx === slides.length - 1 && diff > 30) {
      settledOnBoundary = false;
      isLooping = true;
      scrollToIndex(0);
      setTimeout(function () { isLooping = false; }, 1000);
    }
    if (atTop && idx === 0 && diff < -30) {
      settledOnBoundary = false;
      isLooping = true;
      scrollToIndex(slides.length - 1);
      setTimeout(function () { isLooping = false; }, 1000);
    }
  }, { passive: true });

  function scrollToIndex(index) {
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    var slide = slides[index];
    var slideCenter = slide.offsetTop + slide.offsetHeight * 0.5;
    var targetScroll = slideCenter - track.offsetHeight * 0.5;
    setActive(index);
    track.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }

  function forceScrollToFirst() {
    if (!slides.length) return;
    var slide = slides[0];
    var slideCenter = slide.offsetTop + slide.offsetHeight * 0.5;
    var targetScroll = slideCenter - track.offsetHeight * 0.5;
    track.scrollTop = Math.max(0, targetScroll);
  }

  if (spacerTop) {
    spacerTop.addEventListener('click', function () {
      scrollToIndex(currentIndex - 1);
    });
  }

  if (spacerBottom) {
    spacerBottom.addEventListener('click', function () {
      scrollToIndex(currentIndex + 1);
    });
  }

  if (dots.length > 0) {
    for (var d = 0; d < dots.length; d++) {
      dots[d].addEventListener('click', function () {
        var index = parseInt(this.getAttribute('data-feed-dot'), 10);
        scrollToIndex(index);
      });
    }
  }

  document.addEventListener('keydown', function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      scrollToIndex(currentIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      scrollToIndex(currentIndex - 1);
    }
  });

  for (var s = 0; s < slides.length; s++) {
    slides[s].addEventListener('click', function (e) {
      var slideIndex = parseInt(this.getAttribute('data-feed-slide'), 10);
      if (slideIndex === currentIndex) return;
      if (e.target.closest('[data-feed-info]') && e.target.closest('.is-active')) return;
      e.preventDefault();
      scrollToIndex(slideIndex);
    });
  }

  track.addEventListener('dragstart', function (e) { e.preventDefault(); });

  window.addEventListener('resize', function () {
    setPadding();
    applyTransforms();
  });

  track.style.scrollSnapType = 'none';
  setPadding();
  void track.offsetHeight;

  if (hasResume) {
    var resumeSlide = slides[resumeIndex];
    var resumeCenter = resumeSlide.offsetTop + resumeSlide.offsetHeight * 0.5;
    var resumeTarget = resumeCenter - track.offsetHeight * 0.5;
    track.scrollTop = Math.max(0, resumeTarget);
    applyTransforms();
    setActive(resumeIndex);
  } else {
    forceScrollToFirst();
    applyTransforms();
    setActive(0);
  }

  requestAnimationFrame(frameLoop);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      track.style.scrollSnapType = '';
      track.classList.add('is-ready');
    });
  });

  /* ========================================
     FEATURE-002: View toggle (swipe / grid)
     ======================================== */

  /* Mirror drift-collection's setView: swap `hidden` on the two view
     blocks, set [data-view-mode] on html + section (header icons key
     off this), persist the choice. Swipe stays mounted while hidden so
     no re-init is needed. */
  function applyView(view) {
    if (view !== 'swipe' && view !== 'grid') return;
    if (!gridEl) return; // no grid block rendered — can't switch
    if (view === 'swipe') {
      gridEl.hidden = true;
      feed.hidden = false;
      // Track dimensions may have changed while hidden — recompute spacers
      // and dispatch scroll so the swipe transforms snap into place.
      setPadding();
      if (track) {
        track.dispatchEvent(new Event('scroll'));
      }
    } else {
      feed.hidden = true;
      gridEl.hidden = false;
      // Lazy-load grid images on first reveal (mirrors Collection's pattern).
      if (!gridEl._driftImagesLoaded) {
        gridEl._driftImagesLoaded = true;
        var imgs = gridEl.querySelectorAll('.drift-collection__grid-img[data-src]');
        imgs.forEach(function (img) {
          var full = new Image();
          full.onload = function () {
            img.src = img.dataset.src;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            img.removeAttribute('data-src');
            img.removeAttribute('data-srcset');
            img.classList.add('is-loaded');
          };
          full.src = img.dataset.src;
        });
      }
      gridEl.scrollTop = 0;
    }
    section.setAttribute('data-view-mode', view);
    document.documentElement.setAttribute('data-view-mode', view);
    try { localStorage.setItem('drift-feed-view', view); } catch (e) {}
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', view === 'swipe' ? 'Switch to grid view' : 'Switch to swipe view');
    }
  }

  /* If initial view is grid, run the lazy-load logic up front so the
     blur-up images become real. */
  if (initialView === 'grid' && gridEl && !gridEl._driftImagesLoaded) {
    gridEl._driftImagesLoaded = true;
    var initImgs = gridEl.querySelectorAll('.drift-collection__grid-img[data-src]');
    initImgs.forEach(function (img) {
      var full = new Image();
      full.onload = function () {
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
        img.classList.add('is-loaded');
      };
      full.src = img.dataset.src;
    });
  }

  var toggleBtn = document.querySelector('[data-view-toggle]');
  // If a Collection section is on the page, let drift-collection.js own
  // the toggle button — don't double-wire it.
  var hasCollection = !!document.querySelector('[data-section-type="drift-collection"]');

  if (toggleBtn && allowToggle && !hasCollection) {
    toggleBtn.addEventListener('click', function () {
      var current = section.getAttribute('data-view-mode');
      applyView(current === 'grid' ? 'swipe' : 'grid');
    });
    // Initial aria-label reflects what the click will do
    toggleBtn.setAttribute(
      'aria-label',
      initialView === 'swipe' ? 'Switch to grid view' : 'Switch to swipe view'
    );
    // Keyboard shortcut: V to toggle (matches Collection's pattern)
    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        var current = feed.getAttribute('data-feed-layout');
        applyView(current === 'grid' ? 'swipe' : 'grid');
      }
    });
  }
})();