/* ============================================
   DRIFT Theme by WEBEXP, LLC
   DRIFT Product Stack — JS Controller
   https://webexp.dev
   ============================================ */

(function () {
  'use strict';

  var DESKTOP_BP = 1025;
  var SCALE_MIN = 0.85;
  var BLUR_MAX = 6;
  var OPACITY_MIN = 0.35;
  var PANEL_PEEK = 140;
  var PANEL_DRAG_THRESHOLD = 60;
  var DESC_MAX_HEIGHT = 120;
  var MAGNIFIER_SIZE = 150;
  var MAGNIFIER_ZOOM = 2;

  var root, product, variants, currentVariant;
  var pdpPrices = {};
  var desktopTrack, mobileTrack, panel, handle, backdrop, peek;
  var fullPanel, form, variantInput, atcBtn, atcText, priceEl;
  var selectOptionsBtn, hasVariants, variantSelected = false;
  var activeIndex = 0;
  var mediaCount = 0;
  var isDesktop = false;
  var panelExpanded = false;
  var dragState = null;
  var navStyle = 'thumbnails';

  var thumbs, dots, counterCurrent;
  var sizeChartModal;
  var magnifier, magnifierImg;
  var lowStockEl, lowStockTextEl, lowStockThreshold;
  var inventoryMap = {};

  /* ========================================
     INIT
     ======================================== */

  function init() {
    root = document.querySelector('[data-section-type="drift-product-stack"]');
    if (!root) return;

    navStyle = root.getAttribute('data-nav-style') || 'thumbnails';

    var jsonEl = root.querySelector('[data-pdp-json]');
    if (jsonEl) {
      try { product = JSON.parse(jsonEl.textContent); } catch (e) { product = null; }
    }

    var pricesEl = root.querySelector('[data-pdp-prices]');
    if (pricesEl) {
      try { pdpPrices = JSON.parse(pricesEl.textContent); } catch (e) {}
    }

    if (product) {
      variants = product.variants || [];
      currentVariant = variants.find(function (v) { return v.available; }) || variants[0];
    }

    desktopTrack = root.querySelector('[data-pdp-track="desktop"]');
    mobileTrack = root.querySelector('[data-pdp-track="mobile"]');
    panel = root.querySelector('[data-pdp-panel]');
    handle = root.querySelector('[data-pdp-handle]');
    backdrop = root.querySelector('[data-pdp-backdrop]');
    peek = root.querySelector('[data-pdp-peek]');
    fullPanel = root.querySelector('[data-pdp-full]');
    form = root.querySelector('[data-pdp-form]');
    variantInput = root.querySelector('[data-pdp-variant-id]');
    atcBtn = root.querySelector('[data-pdp-atc]');
    atcText = atcBtn ? atcBtn.querySelector('.drift-pdp__atc-text') : null;
    priceEl = root.querySelector('[data-pdp-price]');
    selectOptionsBtn = root.querySelector('[data-pdp-select-options]');
    hasVariants = !!selectOptionsBtn;
    sizeChartModal = root.querySelector('[data-pdp-size-chart]');

    lowStockEl = root.querySelector('[data-pdp-low-stock]');
    lowStockTextEl = root.querySelector('[data-pdp-low-stock-text]');
    var thresholdAttr = root.getAttribute('data-low-stock-threshold');
    lowStockThreshold = thresholdAttr ? parseInt(thresholdAttr, 10) : 0;

    var invJson = root.querySelector('[data-pdp-inventory]');
    if (invJson) {
      try { inventoryMap = JSON.parse(invJson.textContent); } catch (e) { inventoryMap = {}; }
    }

    thumbs = root.querySelectorAll('[data-pdp-thumb]');
    dots = root.querySelectorAll('[data-pdp-dot]');
    counterCurrent = root.querySelector('[data-pdp-counter-current]');

    mediaCount = root.querySelectorAll('[data-pdp-track="desktop"] [data-pdp-slide]').length;
    isDesktop = window.innerWidth >= DESKTOP_BP;

    setupNavClicks();
    setupPanelSwipe();
    setupVariants();
    setupForm();
    setupBackdrop();
    setupKeyboard();
    setupResize();
    setupDescriptionToggle();
    setupSizeChart();
    setupSelectOptions();
    setupPeekClicks();
    setupMagnifier();
    updateNav(0);

    if (hasVariants && atcBtn) {
      atcBtn.disabled = true;
    }

    if (!hasVariants && product && currentVariant) {
      updateLowStock(currentVariant);
    }

    if (window.innerWidth < DESKTOP_BP) {
      moveAtcToPeek();
    }

    if (desktopTrack) desktopTrack.style.scrollSnapType = 'none';
    if (mobileTrack) mobileTrack.style.scrollSnapType = 'none';

    setupDesktopPadding();

    if (desktopTrack) void desktopTrack.offsetHeight;
    if (mobileTrack) void mobileTrack.offsetHeight;

    forceScrollToFirst();
    setupMediaObservers();
    setupProgressiveLoad();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (desktopTrack) {
          desktopTrack.style.scrollSnapType = '';
          desktopTrack.classList.add('is-ready');
        }
        if (mobileTrack) {
          mobileTrack.style.scrollSnapType = '';
          mobileTrack.classList.add('is-ready');
        }
      });
    });
  }

  /* ========================================
     LOW STOCK INDICATOR
     ======================================== */

  function updateLowStock(variant) {
    if (!lowStockEl || !lowStockThreshold) return;

    var qty = (variant && inventoryMap.hasOwnProperty(String(variant.id)))
      ? inventoryMap[String(variant.id)]
      : null;

    if (qty !== null && qty > 0 && qty <= lowStockThreshold && variant.available) {
      if (lowStockTextEl) lowStockTextEl.textContent = 'Only ' + qty + ' left';
      lowStockEl.removeAttribute('hidden');
    } else {
      lowStockEl.setAttribute('hidden', '');
    }

    if (peek) peek.classList.toggle('has-low-stock', !lowStockEl.hasAttribute('hidden'));
  }

  /* ========================================
     PROGRESSIVE IMAGE LOADING
     ======================================== */

  function setupProgressiveLoad() {
    loadSlideImage(activeIndex);
    setTimeout(function () {
      for (var i = 0; i < mediaCount; i++) {
        if (i !== activeIndex) loadSlideImage(i);
      }
    }, 200);
  }

  function loadSlideImage(idx) {
    var tracks = [desktopTrack, mobileTrack];
    for (var t = 0; t < tracks.length; t++) {
      if (!tracks[t]) continue;
      var slide = tracks[t].querySelector('[data-pdp-slide="' + idx + '"]');
      if (!slide) continue;
      var img = slide.querySelector('.drift-pdp__image[data-src]');
      if (!img) continue;
      var fullSrc = img.getAttribute('data-src');
      if (!fullSrc) continue;
      revealImage(img, fullSrc);
    }
  }

  function revealImage(img, fullSrc) {
    var loader = new Image();
    loader.onload = function () {
      img.src = fullSrc;
      if (img.hasAttribute('data-srcset')) {
        img.srcset = img.getAttribute('data-srcset');
        img.removeAttribute('data-srcset');
      }
      img.removeAttribute('data-src');
      requestAnimationFrame(function () {
        img.classList.remove('drift-img--loading');
        img.classList.add('drift-img--loaded');
        var onEnd = function () {
          img.classList.remove('drift-img--loaded');
          img.removeEventListener('transitionend', onEnd);
        };
        img.addEventListener('transitionend', onEnd);
      });
    };
    loader.onerror = function () {
      img.classList.remove('drift-img--loading');
    };
    loader.src = fullSrc;
  }

  /* ========================================
     FORCE SCROLL TO FIRST SLIDE
     ======================================== */

  function forceScrollToFirst() {
    if (isDesktop && desktopTrack) {
      var slide = desktopTrack.querySelector('[data-pdp-slide="0"]');
      if (slide) {
        var offset = slide.offsetTop - (desktopTrack.clientHeight / 2) + (slide.clientHeight / 2);
        desktopTrack.scrollTop = Math.max(0, offset);
      }
    } else if (mobileTrack) {
      var slide = mobileTrack.querySelector('[data-pdp-slide="0"]');
      if (slide) {
        var offset = slide.offsetLeft - (mobileTrack.clientWidth / 2) + (slide.clientWidth / 2);
        mobileTrack.scrollLeft = Math.max(0, offset);
      }
    }
  }

  /* ========================================
     MEDIA — continuous frame loop
     ======================================== */

  function setupMediaObservers() {
    if (desktopTrack) observeTrack(desktopTrack, 'y');
    if (mobileTrack) observeTrack(mobileTrack, 'x');
  }

  function observeTrack(track, axis) {
    var slides = track.querySelectorAll('[data-pdp-slide]');
    if (!slides.length) return;
    var lastScroll = -1;

    function frameLoop() {
      var st = axis === 'y' ? track.scrollTop : track.scrollLeft;
      if (st !== lastScroll) {
        lastScroll = st;
        updateSlideTransforms(track, slides, axis);
      }
      requestAnimationFrame(frameLoop);
    }

    requestAnimationFrame(frameLoop);
  }

  function getSlideMedia(slide) {
    return slide.querySelector('.drift-pdp__image')
      || slide.querySelector('.drift-pdp__video-wrap')
      || slide.querySelector('.drift-pdp__model-wrap');
  }

  function updateSlideTransforms(track, slides, axis) {
    var trackRect = track.getBoundingClientRect();
    var trackSize = axis === 'y' ? trackRect.height : trackRect.width;
    var trackCenter = axis === 'y'
      ? trackRect.top + trackSize / 2
      : trackRect.left + trackSize / 2;

    var closestIdx = 0;
    var closestDist = Infinity;
    var isMobile = window.innerWidth < 1024;

    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      var rect = s.getBoundingClientRect();
      var slideCenter = axis === 'y'
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2;
      var dist = Math.abs(slideCenter - trackCenter);
      var ratio = Math.min(dist / (trackSize * 0.5), 1);

      var scale = 1 - ratio * (1 - SCALE_MIN);
      var blur = ratio * BLUR_MAX;
      var opacity = 1 - ratio * (1 - OPACITY_MIN);

      var el = getSlideMedia(s);
      if (el) {
        el.style.transform = 'scale(' + scale.toFixed(3) + ')';
        el.style.opacity = opacity.toFixed(3);

        if (isMobile) {
          el.style.removeProperty('filter');
        } else if (blur > 1) {
          el.style.filter = 'blur(' + blur.toFixed(1) + 'px)';
        } else {
          el.style.removeProperty('filter');
        }
      }

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    for (var j = 0; j < slides.length; j++) {
      var media = getSlideMedia(slides[j]);
      if (media) {
        if (j === closestIdx) media.classList.add('is-active');
        else media.classList.remove('is-active');
      }
    }

    if (closestIdx !== activeIndex) {
      activeIndex = closestIdx;
      updateNav(activeIndex);
    }
  }

  /* ========================================
     NAV
     ======================================== */

  function setupNavClicks() {
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        scrollToSlide(parseInt(t.getAttribute('data-pdp-thumb'), 10));
      });
    });

    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        scrollToSlide(parseInt(d.getAttribute('data-pdp-dot'), 10));
      });
    });
  }

  function updateNav(idx) {
    thumbs.forEach(function (t) {
      t.classList.toggle('is-active', parseInt(t.getAttribute('data-pdp-thumb'), 10) === idx);
    });

    dots.forEach(function (d) {
      d.classList.toggle('is-active', parseInt(d.getAttribute('data-pdp-dot'), 10) === idx);
    });

    if (counterCurrent) counterCurrent.textContent = idx + 1;
  }

  function scrollToSlide(idx) {
    if (idx < 0) idx = mediaCount - 1;
    if (idx >= mediaCount) idx = 0;

    var track = isDesktop ? desktopTrack : mobileTrack;
    if (!track) return;
    var slide = track.querySelector('[data-pdp-slide="' + idx + '"]');
    if (!slide) return;

    if (isDesktop) {
      var trackTop = track.getBoundingClientRect().top;
      var slideTop = slide.getBoundingClientRect().top;
      var offset = slideTop - trackTop + track.scrollTop;
      var center = offset - (track.clientHeight / 2) + (slide.clientHeight / 2);
      track.scrollTo({ top: center, behavior: 'smooth' });
    } else {
      var trackLeft = track.getBoundingClientRect().left;
      var slideLeft = slide.getBoundingClientRect().left;
      var offsetX = slideLeft - trackLeft + track.scrollLeft;
      var centerX = offsetX - (track.clientWidth / 2) + (slide.clientWidth / 2);
      track.scrollTo({ left: centerX, behavior: 'smooth' });
    }
  }

  /* ========================================
     DESKTOP PADDING
     ======================================== */

  function setupDesktopPadding() {
    if (!desktopTrack) return;

    function calc() {
      if (window.innerWidth < DESKTOP_BP) return;
      var slides = desktopTrack.querySelectorAll('[data-pdp-slide]');
      if (!slides.length) return;

      var trackH = desktopTrack.clientHeight;
      var slideH = slides[0].clientHeight;
      var peekPad = Math.max(0, (trackH - slideH) / 2);

      desktopTrack.style.paddingTop = peekPad + 'px';
      desktopTrack.style.paddingBottom = peekPad + 'px';
    }

    calc();
    window.addEventListener('resize', debounce(calc, 200));
  }

  /* ========================================
     MOBILE PANEL — swipe
     ======================================== */

  function setupPanelSwipe() {
    if (!panel) return;

    document.addEventListener('touchstart', onPanelTouchStart, { passive: true });
    document.addEventListener('touchmove', onPanelTouchMove, { passive: false });
    document.addEventListener('touchend', onPanelTouchEnd, { passive: true });

    if (peek) {
      peek.addEventListener('click', function (e) {
        if (window.innerWidth >= DESKTOP_BP) return;
        if (e.target.closest('button') || e.target.closest('a')) return;
        if (!panelExpanded) expandPanel();
      });
    }
  }

  function onPanelTouchStart(e) {
    if (window.innerWidth >= DESKTOP_BP) return;
    var t = e.touches[0];
    dragState = {
      startY: t.clientY,
      startX: t.clientX,
      currentY: t.clientY,
      startTime: Date.now(),
      locked: false,
      direction: null
    };
  }

  function onPanelTouchMove(e) {
    if (!dragState || window.innerWidth >= DESKTOP_BP) return;
    var t = e.touches[0];
    dragState.currentY = t.clientY;
    var dy = dragState.currentY - dragState.startY;
    var dx = t.clientX - dragState.startX;

    if (!dragState.direction) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      dragState.direction = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
    }

    if (dragState.direction !== 'vertical') return;

    panel.style.transition = 'none';

    if (panelExpanded) {
      if (panel.scrollTop <= 0 && dy > 0) {
        e.preventDefault();
        panel.style.transform = 'translateY(' + dy + 'px)';
        dragState.locked = true;
      }
    } else {
      if (dy < 0) {
        e.preventDefault();
        panel.style.transform = 'translateY(calc(100% - ' + PANEL_PEEK + 'px + ' + dy + 'px))';
        dragState.locked = true;
      }
    }
  }

  function onPanelTouchEnd() {
    if (!dragState || window.innerWidth >= DESKTOP_BP) return;
    var dy = dragState.currentY - dragState.startY;
    var elapsed = Date.now() - dragState.startTime;
    var velocity = Math.abs(dy) / elapsed;
    var fast = velocity > 0.3;

    panel.style.transition = '';

    if (!dragState.locked) {
      dragState = null;
      return;
    }

    if (panelExpanded) {
      if (dy > PANEL_DRAG_THRESHOLD || (fast && dy > 20)) collapsePanel();
      else expandPanel();
    } else {
      if (dy < -PANEL_DRAG_THRESHOLD || (fast && dy < -20)) expandPanel();
      else collapsePanel();
    }

    dragState = null;
  }

  function moveAtcToFull() {
    var wrap = root.querySelector('[data-pdp-atc-wrap]');
    if (wrap && fullPanel && wrap.parentNode !== fullPanel) {
      wrap.style.opacity = '0';
      fullPanel.appendChild(wrap);
      requestAnimationFrame(function () {
        wrap.style.transition = 'opacity var(--drift-duration-normal) var(--drift-ease)';
        wrap.style.opacity = '1';
      });
    }
  }

  function moveAtcToPeek() {
    var wrap = root.querySelector('[data-pdp-atc-wrap]');
    if (wrap && peek && wrap.parentNode !== peek) {
      wrap.style.opacity = '0';
      peek.appendChild(wrap);
      requestAnimationFrame(function () {
        wrap.style.transition = 'opacity var(--drift-duration-normal) var(--drift-ease)';
        wrap.style.opacity = '1';
      });
    }
  }

  function expandPanel() {
    if (!panel) return;
    panelExpanded = true;
    panel.style.transform = '';
    panel.classList.add('is-expanded');
    if (backdrop) backdrop.classList.add('is-active');
    document.body.style.overflow = 'hidden';

    if (window.innerWidth < DESKTOP_BP) moveAtcToFull();
  }

  function collapsePanel() {
    if (!panel) return;
    panelExpanded = false;
    panel.style.transform = '';
    panel.classList.remove('is-expanded');
    if (backdrop) backdrop.classList.remove('is-active');
    document.body.style.overflow = '';
    panel.scrollTop = 0;

    if (window.innerWidth < DESKTOP_BP) moveAtcToPeek();
  }

  /* ========================================
     BACKDROP
     ======================================== */

  function setupBackdrop() {
    if (!backdrop) return;
    backdrop.addEventListener('click', collapsePanel);
  }

  /* ========================================
     SELECT OPTIONS — expand panel
     ======================================== */

  function setupSelectOptions() {
    if (!selectOptionsBtn) return;

    selectOptionsBtn.addEventListener('click', function () {
      if (window.innerWidth >= DESKTOP_BP) {
        var firstOpt = root.querySelector('.drift-pdp__option-btn');
        if (firstOpt) firstOpt.focus();
      } else {
        expandPanel();
      }
    });
  }

  function revealSubmitButton() {
    if (!hasVariants || variantSelected) return;
    variantSelected = true;
    if (selectOptionsBtn) selectOptionsBtn.classList.add('drift-pdp__atc--hidden');
    if (atcBtn) atcBtn.classList.remove('drift-pdp__atc--hidden');
  }

  /* ========================================
     VARIANTS
     ======================================== */

  function setupVariants() {
    if (!product || !variants.length) return;

    var optBtns = root.querySelectorAll('[data-option-value]');

    updateOptionAvailability();

    optBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-sold-out')) return;

        var idx = parseInt(btn.getAttribute('data-option-index'), 10);
        var val = btn.getAttribute('data-option-value');

        var group = btn.closest('.drift-pdp__option-values');
        if (group) {
          group.querySelectorAll('.drift-pdp__option-btn').forEach(function (b) {
            b.classList.remove('is-active');
          });
        }
        btn.classList.add('is-active');

        var label = root.querySelector('[data-option-selected="' + idx + '"]');
        if (label) label.textContent = '[ ' + val + ' ]';

        var selected = getSelectedOptions();
        selected[idx] = val;
        var match = findVariant(selected);
        if (match) {
          currentVariant = match;
          updateVariantUI(match);
          updateLowStock(match);
          revealSubmitButton();
        }

        updateOptionAvailability();
      });
    });
  }

  function updateOptionAvailability() {
    if (!product) return;

    product.options.forEach(function (optName, optIdx) {
      var btns = root.querySelectorAll('[data-option-index="' + optIdx + '"]');
      btns.forEach(function (btn) {
        var val = btn.getAttribute('data-option-value');

        var available = variants.some(function (v) {
          return v.options[optIdx] === val && v.available;
        });

        if (available) {
          btn.classList.remove('is-sold-out');
          btn.disabled = false;
        } else {
          btn.classList.add('is-sold-out');
          btn.classList.remove('is-active');
        }
      });
    });
  }

  function getSelectedOptions() {
    var opts = [];
    if (!product) return opts;
    for (var i = 0; i < product.options.length; i++) {
      var active = root.querySelector('[data-option-index="' + i + '"].is-active');
      if (active) {
        opts.push(active.getAttribute('data-option-value'));
      } else {
        opts.push(null);
      }
    }
    return opts;
  }

  function findVariant(selected) {
    if (selected.indexOf(null) !== -1) return null;
    return variants.find(function (v) {
      return v.options.every(function (opt, i) {
        return opt === selected[i];
      });
    }) || null;
  }

  function updateVariantUI(v) {
    if (variantInput) variantInput.value = v.id;

    if (priceEl) {
      var prices = pdpPrices[v.id];
      if (prices) {
        if (prices.compare_at_price) {
          priceEl.innerHTML = '<s class="drift-pdp__compare">' + prices.compare_at_price + '</s> ' + prices.price;
        } else {
          priceEl.innerHTML = prices.price;
        }
      } else if (v.compare_at_price && v.compare_at_price > v.price) {
        priceEl.innerHTML = '<s class="drift-pdp__compare">' + formatMoney(v.compare_at_price) + '</s> ' + formatMoney(v.price);
      } else {
        priceEl.textContent = formatMoney(v.price);
      }
    }

    if (atcBtn) {
      var isPreorder = atcBtn.getAttribute('data-preorder') === 'true';
      var preorderText = atcBtn.getAttribute('data-preorder-text') || 'Pre-Order';
      // BUG-013: pre-order is a label override only. Disabled state still
      // follows variant availability — merchants use Shopify's "continue
      // selling when out of stock" inventory policy to make sold-out
      // variants buyable, not this metafield.
      if (v.available) {
        atcBtn.disabled = false;
        if (atcText) atcText.textContent = isPreorder ? preorderText : 'Add to Cart';
      } else {
        atcBtn.disabled = true;
        if (atcText) atcText.textContent = 'Sold Out';
      }
    }

    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  function formatMoney(cents) {
    var rate = (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.rate)
      ? parseFloat(Shopify.currency.rate)
      : 1;
    var currencyCode = (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.active)
      ? Shopify.currency.active
      : 'USD';
    var amount = (cents * rate) / 100;
    var isWhole = amount === Math.floor(amount);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '$' + amount.toFixed(isWhole ? 0 : 2);
    }
  }

  /* ========================================
     FORM — AJAX add to cart
     ======================================== */

  function setupForm() {
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!atcBtn || atcBtn.disabled) return;

      var origText = atcText ? atcText.textContent : 'Add to Cart';
      atcBtn.disabled = true;
      if (atcText) atcText.textContent = 'Adding...';

      var formData = new FormData(form);
      var body = {};
      formData.forEach(function (val, key) { body[key] = val; });

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(body.id, 10), quantity: parseInt(body.quantity, 10) }] })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Add to cart failed');
          return res.json();
        })
        .then(function () {
          if (atcText) atcText.textContent = 'Added ✓';
          setTimeout(function () {
            atcBtn.disabled = false;
            if (atcText) atcText.textContent = origText;
          }, 1500);
          updateCartCount();
          document.dispatchEvent(new CustomEvent('cart:updated'));
        })
        .catch(function () {
          if (atcText) atcText.textContent = 'Error';
          setTimeout(function () {
            atcBtn.disabled = false;
            if (atcText) atcText.textContent = origText;
          }, 1500);
        });
    });
  }

  function updateCartCount() {
    fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var bubbles = document.querySelectorAll('[data-cart-count]');
        bubbles.forEach(function (b) {
          b.textContent = cart.item_count;
          if (cart.item_count > 0) b.removeAttribute('hidden');
          else b.setAttribute('hidden', '');
        });
      })
      .catch(function () {});
  }

  /* ========================================
     DESCRIPTION TOGGLE
     ======================================== */

  function setupDescriptionToggle() {
    var descEl = root.querySelector('[data-pdp-description]');
    var toggleBtn = root.querySelector('[data-pdp-description-toggle]');
    var toggleText = root.querySelector('[data-pdp-description-toggle-text]');
    if (!descEl || !toggleBtn) return;

    var expanded = false;

    function check() {
      if (window.innerWidth >= DESKTOP_BP) {
        descEl.style.maxHeight = '';
        descEl.classList.remove('is-clamped');
        toggleBtn.hidden = true;
        return;
      }

      descEl.style.maxHeight = 'none';
      var natural = descEl.scrollHeight;

      if (natural > DESC_MAX_HEIGHT) {
        toggleBtn.hidden = false;
        if (!expanded) {
          descEl.style.maxHeight = DESC_MAX_HEIGHT + 'px';
          descEl.classList.add('is-clamped');
        } else {
          descEl.style.maxHeight = natural + 'px';
          descEl.classList.remove('is-clamped');
        }
      } else {
        toggleBtn.hidden = true;
        descEl.style.maxHeight = '';
        descEl.classList.remove('is-clamped');
      }
    }

    toggleBtn.addEventListener('click', function () {
      expanded = !expanded;
      if (toggleText) toggleText.textContent = expanded ? 'Show Less' : 'Show More';
      check();
    });

    check();
    window.addEventListener('resize', debounce(check, 200));
  }

  /* ========================================
     SIZE CHART
     ======================================== */

  function setupSizeChart() {
    if (!sizeChartModal) return;

    var openers = root.querySelectorAll('[data-pdp-size-chart-open]');
    var closers = root.querySelectorAll('[data-pdp-size-chart-close]');

    openers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        sizeChartModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    });

    closers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        sizeChartModal.classList.remove('is-open');
        if (!panelExpanded) document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sizeChartModal.classList.contains('is-open')) {
        sizeChartModal.classList.remove('is-open');
        if (!panelExpanded) document.body.style.overflow = '';
      }
    });
  }

  /* ========================================
     MAGNIFIER — Desktop hover zoom (2×)
     ======================================== */

  function setupMagnifier() {
    var zoomSetting = root.getAttribute('data-media-zoom');
    if (zoomSetting !== 'magnifier') return;
    if (window.innerWidth < DESKTOP_BP) return;
    if (!desktopTrack) return;

    magnifier = document.createElement('span');
    magnifier.className = 'drift-pdp__magnifier';
    magnifierImg = document.createElement('img');
    magnifierImg.className = 'drift-pdp__magnifier-img';
    magnifierImg.draggable = false;
    magnifier.appendChild(magnifierImg);
    document.body.appendChild(magnifier);

    desktopTrack.addEventListener('mousemove', onMagnifierMove);
    desktopTrack.addEventListener('mouseleave', onMagnifierLeave);
  }

  function onMagnifierMove(e) {
    if (window.innerWidth < DESKTOP_BP) return;

    var slide = e.target.closest('[data-pdp-slide]');
    if (!slide) { onMagnifierLeave(); return; }

    var mediaType = slide.getAttribute('data-media-type');
    if (mediaType !== 'image') { onMagnifierLeave(); return; }

    var img = slide.querySelector('.drift-pdp__image');
    if (!img) { onMagnifierLeave(); return; }

    var hiResSrc = img.getAttribute('data-magnify-src') || img.src;
    if (magnifierImg.src !== hiResSrc) {
      magnifierImg.src = hiResSrc;
    }

    var imgRect = img.getBoundingClientRect();

    var ratioX = Math.max(0, Math.min(1, (e.clientX - imgRect.left) / imgRect.width));
    var ratioY = Math.max(0, Math.min(1, (e.clientY - imgRect.top) / imgRect.height));

    if (e.clientX < imgRect.left || e.clientX > imgRect.right ||
        e.clientY < imgRect.top || e.clientY > imgRect.bottom) {
      onMagnifierLeave();
      return;
    }

    var zoomedW = imgRect.width * MAGNIFIER_ZOOM;
    var zoomedH = imgRect.height * MAGNIFIER_ZOOM;
    magnifierImg.style.width = zoomedW + 'px';
    magnifierImg.style.height = zoomedH + 'px';

    var offsetX = -(ratioX * zoomedW - MAGNIFIER_SIZE / 2);
    var offsetY = -(ratioY * zoomedH - MAGNIFIER_SIZE / 2);
    magnifierImg.style.left = offsetX + 'px';
    magnifierImg.style.top = offsetY + 'px';

    magnifier.style.left = (e.clientX - MAGNIFIER_SIZE / 2) + 'px';
    magnifier.style.top = (e.clientY - MAGNIFIER_SIZE / 2) + 'px';

    magnifier.classList.add('is-active');
  }

  function onMagnifierLeave() {
    if (magnifier) magnifier.classList.remove('is-active');
  }

  /* ========================================
     PEEK — click + arrow cursor on desktop track
     ======================================== */

  function setupPeekClicks() {
    if (!desktopTrack) return;

    desktopTrack.addEventListener('click', function (e) {
      if (window.innerWidth < DESKTOP_BP) return;
      if (e.target.closest('.drift-pdp__model-wrap')) return;

      var trackRect = desktopTrack.getBoundingClientRect();
      var y = e.clientY - trackRect.top;
      var half = trackRect.height / 2;

      if (y < half && activeIndex > 0) {
        scrollToSlide(activeIndex - 1);
      } else if (y >= half && activeIndex < mediaCount - 1) {
        scrollToSlide(activeIndex + 1);
      }
    });

    desktopTrack.addEventListener('mousemove', function (e) {
      if (window.innerWidth < DESKTOP_BP) return;
      if (e.target.closest('.drift-pdp__model-wrap')) {
        desktopTrack.removeAttribute('data-cursor');
        return;
      }

      var trackRect = desktopTrack.getBoundingClientRect();
      var y = e.clientY - trackRect.top;
      var half = trackRect.height / 2;

      if (y < half && activeIndex > 0) {
        desktopTrack.setAttribute('data-cursor', 'up');
      } else if (y >= half && activeIndex < mediaCount - 1) {
        desktopTrack.setAttribute('data-cursor', 'down');
      } else {
        desktopTrack.removeAttribute('data-cursor');
      }
    });

    desktopTrack.addEventListener('mouseleave', function () {
      desktopTrack.removeAttribute('data-cursor');
    });
  }

  /* ========================================
     KEYBOARD
     ======================================== */

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (!root) return;
      if (sizeChartModal && sizeChartModal.classList.contains('is-open')) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
        e.preventDefault();
        scrollToSlide(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        scrollToSlide(activeIndex - 1);
      }

      if (e.key === 'Escape' && panelExpanded) collapsePanel();
    });
  }

  /* ========================================
     RESIZE
     ======================================== */

  function setupResize() {
    window.addEventListener('resize', debounce(function () {
      var wasDesktop = isDesktop;
      isDesktop = window.innerWidth >= DESKTOP_BP;
      if (wasDesktop !== isDesktop) {
        if (isDesktop && panelExpanded) collapsePanel();
        if (isDesktop) moveAtcToFull();
        else moveAtcToPeek();
        activeIndex = 0;
        updateNav(0);

        if (!isDesktop && magnifier) {
          magnifier.classList.remove('is-active');
        }
      }
    }, 150));
  }

  /* ========================================
     UTILITY
     ======================================== */

  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  /* ========================================
     BOOT
     ======================================== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (e) {
    if (e.target.querySelector('[data-section-type="drift-product-stack"]')) init();
  });
})();