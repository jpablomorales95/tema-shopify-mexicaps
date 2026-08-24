/* ============================================
   DRIFT Theme by WEBEXP, LLC
   DRIFT Collection — Filter + Sort (V2)
   AJAX filtering via Section Rendering API
   https://webexp.dev
   ============================================ */

(function () {
  'use strict';

  var section = document.querySelector('[data-section-type="drift-collection"]');
  if (!section) return;

  var sectionId = section.getAttribute('data-section-id');

  /* ── Element refs ── */
  var filterBtn, sortBtn, filterDropdown, sortDropdown;
  var backdrop, mobileDrawer, mobileTabs, mobilePanels, filterGroupToggles;

  var isDesktop = function () { return window.innerWidth >= 1024; };
  var isLoading = false;

  function grabRefs() {
    filterBtn = document.querySelector('[data-collection-filter-toggle]');
    sortBtn = document.querySelector('[data-collection-sort-toggle]');
    filterDropdown = document.querySelector('[data-filter-dropdown]');
    sortDropdown = document.querySelector('[data-sort-dropdown]');
    backdrop = document.querySelector('[data-collection-mobile-backdrop]');
    mobileDrawer = document.querySelector('[data-collection-mobile-drawer]');
    mobileTabs = document.querySelectorAll('[data-mobile-tab]');
    mobilePanels = document.querySelectorAll('[data-mobile-panel]');
    filterGroupToggles = document.querySelectorAll('[data-filter-group-toggle]');
    section = document.querySelector('[data-section-type="drift-collection"]');
  }

  /* ════════════════════════════════════════════
     DESKTOP DROPDOWNS
     ════════════════════════════════════════════ */

  function closeAllDropdowns() {
    if (filterDropdown) {
      filterDropdown.classList.remove('is-open');
      filterDropdown.setAttribute('aria-hidden', 'true');
    }
    if (sortDropdown) {
      sortDropdown.classList.remove('is-open');
      sortDropdown.setAttribute('aria-hidden', 'true');
    }
    if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
    if (sortBtn) sortBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown(dropdown, btn) {
    if (!dropdown || !isDesktop()) return;

    var isOpen = dropdown.classList.contains('is-open');
    closeAllDropdowns();

    if (!isOpen) {
      dropdown.classList.add('is-open');
      dropdown.setAttribute('aria-hidden', 'false');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  }

  /* Close on outside click */
  document.addEventListener('click', function (e) {
    if (!isDesktop()) return;
    var clickedFilter = (filterDropdown && filterDropdown.contains(e.target)) || (filterBtn && filterBtn.contains(e.target));
    var clickedSort = (sortDropdown && sortDropdown.contains(e.target)) || (sortBtn && sortBtn.contains(e.target));
    if (!clickedFilter && !clickedSort) {
      closeAllDropdowns();
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeMobileDrawer();
    }
  });

  /* ════════════════════════════════════════════
     MOBILE DRAWER
     ════════════════════════════════════════════ */

  function openMobileDrawer(tab) {
    if (!mobileDrawer || !backdrop) return;

    backdrop.classList.add('is-open');
    mobileDrawer.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (tab) switchMobileTab(tab);
  }

  function closeMobileDrawer() {
    if (!mobileDrawer || !backdrop) return;

    backdrop.classList.remove('is-open');
    mobileDrawer.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function switchMobileTab(tabName) {
    mobileTabs.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-mobile-tab') === tabName);
    });
    mobilePanels.forEach(function (p) {
      var isTarget = p.getAttribute('data-mobile-panel') === tabName;
      p.classList.toggle('is-active', isTarget);
      p.style.display = isTarget ? 'block' : 'none';
    });
  }

  /* ════════════════════════════════════════════
     FILTER + SORT — URL BUILDERS
     ════════════════════════════════════════════ */

  function buildFilterURL() {
    var params = new URLSearchParams();

    /* Use the visible form (desktop or mobile) */
    var form = isDesktop()
      ? document.querySelector('[data-filter-form]')
      : document.querySelector('[data-filter-form-mobile]');

    if (!form) return window.location.pathname;

    /* Checkboxes */
    var checks = form.querySelectorAll('[data-filter-input]');
    checks.forEach(function (input) {
      if (input.checked) {
        params.append(input.name, input.value);
      }
    });

    /* Price range */
    var minInput = form.querySelector('[name*="price_range.gte"]');
    var maxInput = form.querySelector('[name*="price_range.lte"]');

    if (minInput && minInput.value !== '') {
      params.append(minInput.name, (parseFloat(minInput.value) * 100).toString());
    }
    if (maxInput && maxInput.value !== '') {
      params.append(maxInput.name, (parseFloat(maxInput.value) * 100).toString());
    }

    /* Preserve sort */
    var currentParams = new URLSearchParams(window.location.search);
    var sortVal = currentParams.get('sort_by');
    if (sortVal) params.append('sort_by', sortVal);

    var qs = params.toString();
    return window.location.pathname + (qs ? '?' + qs : '');
  }

  function buildSortURL(sortValue) {
    var params = new URLSearchParams(window.location.search);
    params.set('sort_by', sortValue);
    return window.location.pathname + '?' + params.toString();
  }

  /* ════════════════════════════════════════════
     AJAX FETCH + RENDER
     ════════════════════════════════════════════ */

  function fetchAndRender(url) {
    if (isLoading) return;
    isLoading = true;

    section.classList.add('is-loading');

    var fetchURL = url + (url.includes('?') ? '&' : '?') + 'sections=' + sectionId;

    fetch(fetchURL)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var html = data[sectionId];
        if (!html) return;

        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        /* ── Swap main collection (feed + grid) ── */
        var newCollection = doc.querySelector('[data-section-type="drift-collection"]');
        if (newCollection && section) {
          section.innerHTML = newCollection.innerHTML;
          section.setAttribute('data-view-mode', newCollection.getAttribute('data-view-mode') || 'feed');
          section.setAttribute('data-hover-effect', newCollection.getAttribute('data-hover-effect') || 'grow');
          section.setAttribute('data-default-view', newCollection.getAttribute('data-default-view') || 'feed');
          section.setAttribute('data-allow-toggle', newCollection.getAttribute('data-allow-toggle') || 'false');
        }

        /* ── Swap title bar ── */
        var newTitleBar = doc.querySelector('[data-collection-title-bar]');
        var oldTitleBar = document.querySelector('[data-collection-title-bar]');
        if (newTitleBar && oldTitleBar) {
          oldTitleBar.outerHTML = newTitleBar.outerHTML;
        }

        /* ── Swap desktop filter dropdown ── */
        var newFilterDD = doc.querySelector('[data-filter-dropdown]');
        var oldFilterDD = document.querySelector('[data-filter-dropdown]');
        if (newFilterDD && oldFilterDD) {
          oldFilterDD.outerHTML = newFilterDD.outerHTML;
        }

        /* ── Swap desktop sort dropdown ── */
        var newSortDD = doc.querySelector('[data-sort-dropdown]');
        var oldSortDD = document.querySelector('[data-sort-dropdown]');
        if (newSortDD && oldSortDD) {
          oldSortDD.outerHTML = newSortDD.outerHTML;
        }

        /* ── Swap mobile backdrop ── */
        var newBackdrop = doc.querySelector('[data-collection-mobile-backdrop]');
        var oldBackdrop = document.querySelector('[data-collection-mobile-backdrop]');
        if (newBackdrop && oldBackdrop) {
          oldBackdrop.outerHTML = newBackdrop.outerHTML;
        }

        /* ── Swap mobile drawer ── */
        var newDrawer = doc.querySelector('[data-collection-mobile-drawer]');
        var oldDrawer = document.querySelector('[data-collection-mobile-drawer]');
        if (newDrawer && oldDrawer) {
          oldDrawer.outerHTML = newDrawer.outerHTML;
        }

        /* Update URL without reload */
        history.pushState(null, '', url);

        /* Re-grab refs + rebind all events */
        grabRefs();
        bindAll();

        /* ── Re-init feed JS ── */
        reinitFeed();

        /* ── Re-init collection view toggle JS ── */
        reinitCollection();

        /* ── Load grid images if grid is visible ── */
        var gridEl = section.querySelector('[data-collection-view="grid"]');
        if (gridEl && !gridEl.hidden) {
          loadGridImages();
        }
      })
      .catch(function (err) {
        console.error('[DRIFT] Filter/sort fetch error:', err);
      })
      .finally(function () {
        isLoading = false;
        section.classList.remove('is-loading');
        closeAllDropdowns();
        closeMobileDrawer();
      });
  }

  /* ════════════════════════════════════════════
     RE-INIT FEED + COLLECTION SCRIPTS
     ════════════════════════════════════════════ */

  function reinitFeed() {
    var feedScript = document.querySelector('script[src*="drift-feed"]');
    if (!feedScript) return;

    var src = feedScript.getAttribute('src');
    var newScript = document.createElement('script');
    newScript.src = src + '?t=' + Date.now();
    newScript.defer = true;
    feedScript.parentNode.removeChild(feedScript);
    document.body.appendChild(newScript);
  }

  function reinitCollection() {
    var colScript = document.querySelector('script[src*="drift-collection"]');
    if (!colScript) return;

    var src = colScript.getAttribute('src');
    var newScript = document.createElement('script');
    newScript.src = src + '?t=' + Date.now();
    newScript.defer = true;
    colScript.parentNode.removeChild(colScript);
    document.body.appendChild(newScript);
  }

  /* ── Grid image loader ── */
  function loadGridImages() {
    var imgs = section.querySelectorAll('.drift-collection__grid-img[data-src]');
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

  /* ════════════════════════════════════════════
     EVENT BINDING
     ════════════════════════════════════════════ */

  function bindAll() {
    /* Filter button */
    if (filterBtn) {
      filterBtn.addEventListener('click', function () {
        if (isDesktop()) {
          toggleDropdown(filterDropdown, filterBtn);
        } else {
          openMobileDrawer('filter');
        }
      });
    }

    /* Sort button */
    if (sortBtn) {
      sortBtn.addEventListener('click', function () {
        if (isDesktop()) {
          toggleDropdown(sortDropdown, sortBtn);
        } else {
          openMobileDrawer('sort');
        }
      });
    }

    /* Backdrop */
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileDrawer);
    }

    /* Swipe-down to close */
    if (mobileDrawer) {
      var startY = 0;
      var handle = mobileDrawer.querySelector('[data-collection-mobile-handle]');
      var target = handle || mobileDrawer;

      target.addEventListener('touchstart', function (e) {
        startY = e.touches[0].clientY;
      }, { passive: true });

      target.addEventListener('touchend', function (e) {
        var diff = e.changedTouches[0].clientY - startY;
        if (diff > 60) closeMobileDrawer();
      }, { passive: true });
    }

    /* Mobile tabs */
    mobileTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchMobileTab(tab.getAttribute('data-mobile-tab'));
      });
    });

    /* Filter group accordions */
    filterGroupToggles.forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
      });
    });

    /* Filter forms */
    var forms = document.querySelectorAll('[data-filter-form], [data-filter-form-mobile]');
    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        fetchAndRender(buildFilterURL());
      });
    });

    /* Sort options */
    var sortOpts = document.querySelectorAll('[data-sort-value]');
    sortOpts.forEach(function (opt) {
      opt.addEventListener('click', function () {
        fetchAndRender(buildSortURL(opt.getAttribute('data-sort-value')));
      });
    });

    /* Clear filter buttons */
    var clears = document.querySelectorAll('[data-filter-clear]');
    clears.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var url = btn.getAttribute('href');
        var currentParams = new URLSearchParams(window.location.search);
        var sortVal = currentParams.get('sort_by');
        if (sortVal) url += '?sort_by=' + sortVal;
        fetchAndRender(url);
      });
    });
  }

  /* ── Browser back/forward ── */
  window.addEventListener('popstate', function () {
    fetchAndRender(window.location.href);
  });

  /* ── Initial setup ── */
  grabRefs();
  bindAll();

})();