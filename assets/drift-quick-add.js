/* ============================================
   DRIFT Theme by WEBEXP, LLC
   Quick-Add Overlay — Mini PDP (V3)
   https://webexp.dev
   ============================================ */

(function () {
  'use strict';

  var DESKTOP_BP = 1024;
  var DESC_MAX_HEIGHT = 100;
  var DRAG_THRESHOLD = 60;

  /* ── DOM ── */
  var overlay = document.querySelector('[data-quick-add]');
  if (!overlay) return;

  var bk = overlay.querySelector('[data-qa-backdrop]');
  var modal = overlay.querySelector('[data-qa-modal]');
  var infoEl = overlay.querySelector('[data-qa-info]');
  var imageEl = overlay.querySelector('[data-qa-image]');
  var handleEl = overlay.querySelector('[data-qa-handle]');
  var titleEl = overlay.querySelector('[data-qa-title]');
  var descEl = overlay.querySelector('[data-qa-description]');
  var descToggle = overlay.querySelector('[data-qa-description-toggle]');
  var descToggleText = overlay.querySelector('[data-qa-description-toggle-text]');
  var variantsWrap = overlay.querySelector('[data-qa-variants]');
  var selectBtn = overlay.querySelector('[data-qa-select-options]');
  var selectPrice = overlay.querySelector('[data-qa-select-price]');
  var atcBtn = overlay.querySelector('[data-qa-atc]');
  var atcText = overlay.querySelector('[data-qa-atc-text]');
  var priceEl = overlay.querySelector('[data-qa-price]');
  var viewFullLink = overlay.querySelector('[data-qa-view-full]');

  /* ── State ── */
  var isOpen = false;
  var product = null;
  var variants = [];
  var currentVariant = null;
  var variantSelected = false;
  var descExpanded = false;
  var dragState = null;
  var qaProductPrices = null;
  var qaVariantPrices = {};
  /* Preorder state — set by open() from the trigger button's data attributes,
     because /products/[handle].js doesn't include metafields. */
  var qaIsPreorder = false;
  var qaPreorderText = 'Pre-Order';

  /* ========================================
     DIRECT ADD — single-variant products
     ======================================== */

  function directAdd(productData) {
    var v = productData.variants[0];
    /* BUG-013: pre-order is a label override only. If a sold-out variant
       needs to be buyable, the merchant uses Shopify's "continue selling
       when out of stock" inventory policy — that makes v.available true. */
    if (!v || !v.available) return;

    var triggers = document.querySelectorAll('[data-product-url="' + productData.url + '.js"]');

    triggers.forEach(function (btn) {
      btn.disabled = true;
      btn.classList.add('is-adding');
    });

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Add failed');
        return r.json();
      })
      .then(function () {
        triggers.forEach(function (btn) {
          btn.classList.add('is-added');
          setTimeout(function () {
            btn.disabled = false;
            btn.classList.remove('is-adding', 'is-added');
          }, 1200);
        });
        document.dispatchEvent(new CustomEvent('cart:updated'));
      })
      .catch(function () {
        triggers.forEach(function (btn) {
          btn.disabled = false;
          btn.classList.remove('is-adding');
        });
      });
  }

  /* ========================================
     OPEN / CLOSE
     ======================================== */

  function open(productUrl, layout, pagePrices, preorderConfig) {
    if (isOpen) return;

    overlay.setAttribute('data-qa-layout', layout || 'grid');

    /* Preorder config from trigger's data attributes */
    qaIsPreorder = !!(preorderConfig && preorderConfig.isPreorder);
    qaPreorderText = (preorderConfig && preorderConfig.preorderText) || 'Pre-Order';

    /* Use Liquid-rendered prices from the page (full Markets context).
       Section Rendering API would render in shop base currency only,
       so we read pre-rendered values from a sibling script tag instead. */
    qaProductPrices = null;
    qaVariantPrices = {};
    if (pagePrices) {
      qaProductPrices = {
        price_min: pagePrices.price_min,
        price_max: pagePrices.price_max,
        compare_at_price_max: pagePrices.compare_at_price_max,
        price_varies: pagePrices.price_varies
      };
      qaVariantPrices = pagePrices.variants || {};
    }

    fetch(productUrl, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        product = data;
        variants = product.variants || [];

        var hasOnlyDefault = variants.length === 1 && variants[0].title === 'Default Title';
        if (hasOnlyDefault) {
          directAdd(product);
          return;
        }

        currentVariant = variants.find(function (v) { return v.available; }) || variants[0];
        variantSelected = false;
        descExpanded = false;

        render();

        overlay.setAttribute('aria-hidden', 'true');
        void overlay.offsetHeight;

        isOpen = true;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      })
      .catch(function (err) { console.error('[DRIFT quick-add]', err); });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (infoEl) {
      infoEl.classList.remove('is-expanded');
      infoEl.style.transform = '';
    }
    product = null;
    variants = [];
    currentVariant = null;
  }

  /* ========================================
     RENDER
     ======================================== */

  function render() {
    if (!product) return;

    if (titleEl) titleEl.textContent = product.title;

    if (imageEl) {
      var img = product.featured_image || (product.images && product.images[0]);
      if (img) {
        var src = typeof img === 'string' ? img : img.src || img;
        imageEl.src = src;
        imageEl.alt = product.title;
      } else {
        imageEl.src = '';
        imageEl.alt = '';
      }
    }

    if (descEl) {
      var html = product.body_html;
      if (html && typeof html === 'string' && html.trim().length > 0) {
        descEl.innerHTML = html;
        descEl.style.display = '';
        descEl.style.margin = '';
        setupDescription();
      } else {
        descEl.innerHTML = '';
        descEl.style.display = 'none';
        descEl.style.margin = '0';
        if (descToggle) descToggle.hidden = true;
      }
    }

    if (viewFullLink) viewFullLink.href = product.url;

    renderVariants();
    updateAtcState();
  }

  /* ========================================
     DESCRIPTION
     ======================================== */

  function setupDescription() {
    if (!descEl || !descToggle) return;
    descExpanded = false;
    if (descToggleText) descToggleText.textContent = 'Show More';

    requestAnimationFrame(function () {
      if (window.innerWidth >= DESKTOP_BP) {
        descEl.style.maxHeight = '';
        descEl.classList.remove('is-clamped');
        descToggle.hidden = true;
        return;
      }

      var natural = descEl.scrollHeight;
      if (natural > DESC_MAX_HEIGHT) {
        descToggle.hidden = false;
        descEl.style.maxHeight = DESC_MAX_HEIGHT + 'px';
        descEl.classList.add('is-clamped');
      } else {
        descToggle.hidden = true;
        descEl.style.maxHeight = '';
        descEl.classList.remove('is-clamped');
      }
    });
  }

  if (descToggle) {
    descToggle.addEventListener('click', function () {
      if (!descEl) return;
      descExpanded = !descExpanded;
      if (descToggleText) descToggleText.textContent = descExpanded ? 'Show Less' : 'Show More';
      if (descExpanded) {
        descEl.style.maxHeight = descEl.scrollHeight + 'px';
        descEl.classList.remove('is-clamped');
      } else {
        descEl.style.maxHeight = DESC_MAX_HEIGHT + 'px';
        descEl.classList.add('is-clamped');
      }
    });
  }

  /* ========================================
     VARIANTS
     ======================================== */

  function renderVariants() {
    if (!variantsWrap || !product) return;

    var html = '';

    product.options.forEach(function (opt, optIdx) {
      var optName = typeof opt === 'string' ? opt : (opt.name || opt);
      html += '<span class="drift-qa__option">';
      html += '<span class="drift-qa__option-label">' + escHtml(optName);
      html += '<span class="drift-qa__option-selected" data-qa-option-selected="' + optIdx + '"></span>';
      html += '</span>';
      html += '<span class="drift-qa__option-values">';

      var values = [];
      product.variants.forEach(function (v) {
        var val = v.options[optIdx];
        if (values.indexOf(val) === -1) values.push(val);
      });

      values.forEach(function (val) {
        var available = variants.some(function (v) {
          return v.options[optIdx] === val && v.available;
        });

        html += '<button class="drift-qa__option-btn' + (!available ? ' is-sold-out' : '') + '"';
        html += ' data-qa-option-index="' + optIdx + '"';
        html += ' data-qa-option-value="' + escHtml(val) + '"';
        html += ' type="button"';
        if (!available) html += ' disabled';
        html += '>' + escHtml(val) + '</button>';
      });

      html += '</span></span>';
    });

    variantsWrap.innerHTML = html;
    bindVariantEvents();
  }

  function bindVariantEvents() {
    var btns = variantsWrap.querySelectorAll('[data-qa-option-value]');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-sold-out')) return;

        var idx = parseInt(btn.getAttribute('data-qa-option-index'), 10);
        var val = btn.getAttribute('data-qa-option-value');

        var group = btn.closest('.drift-qa__option-values');
        if (group) {
          group.querySelectorAll('.drift-qa__option-btn').forEach(function (b) {
            b.classList.remove('is-active');
          });
        }
        btn.classList.add('is-active');

        var label = variantsWrap.querySelector('[data-qa-option-selected="' + idx + '"]');
        if (label) label.textContent = '[ ' + val + ' ]';

        var selected = getSelectedOptions();
        selected[idx] = val;
        var match = findVariant(selected);
        if (match) {
          currentVariant = match;
          /* FIX: reveal first so variantSelected is true when updateAtcState runs */
          revealSubmitButton();
          updateAtcState();
        }

        updateOptionAvailability();
      });
    });
  }

  function getSelectedOptions() {
    var opts = [];
    if (!product) return opts;
    for (var i = 0; i < product.options.length; i++) {
      var active = variantsWrap.querySelector('[data-qa-option-index="' + i + '"].is-active');
      opts.push(active ? active.getAttribute('data-qa-option-value') : null);
    }
    return opts;
  }

  function findVariant(selected) {
    if (selected.indexOf(null) !== -1) return null;
    return variants.find(function (v) {
      return v.options.every(function (opt, i) { return opt === selected[i]; });
    }) || null;
  }

  function updateOptionAvailability() {
    if (!product) return;

    product.options.forEach(function (opt, optIdx) {
      var btns = variantsWrap.querySelectorAll('[data-qa-option-index="' + optIdx + '"]');
      btns.forEach(function (btn) {
        var val = btn.getAttribute('data-qa-option-value');
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

  function revealSubmitButton() {
    if (variantSelected) return;
    variantSelected = true;
    if (selectBtn) selectBtn.hidden = true;
    if (atcBtn) atcBtn.hidden = false;
  }

  /* ========================================
     ATC STATE
     ======================================== */

  function updateAtcState() {
    if (!product) return;

    if (!variantSelected) {
      /* Multi-variant, nothing selected yet — show Select Options */
      if (selectBtn) {
        selectBtn.hidden = false;
        if (selectPrice) {
          var minPrice = qaProductPrices && qaProductPrices.price_min
            ? qaProductPrices.price_min
            : formatMoney(product.price_min);
          var priceStr = product.price_varies
            ? 'From ' + minPrice
            : minPrice;

          if (!product.price_varies) {
            var hasCompare = variants.some(function (v) {
              return v.compare_at_price && v.compare_at_price > v.price;
            });
            if (hasCompare && product.compare_at_price_min) {
              var compareMax = qaProductPrices && qaProductPrices.compare_at_price_max
                ? qaProductPrices.compare_at_price_max
                : formatMoney(product.compare_at_price_max);
              priceStr = '<s class="drift-qa__compare">' + compareMax + '</s> ' + priceStr;
            }
          }

          selectPrice.innerHTML = priceStr;
        }
      }
      if (atcBtn) atcBtn.hidden = true;
    } else {
      /* Variant selected — show Add to Cart / Sold Out */
      if (selectBtn) selectBtn.hidden = true;
      if (atcBtn) atcBtn.hidden = false;
      if (currentVariant) {
        /* Compare-at pricing */
        if (priceEl) {
          var vPrices = qaVariantPrices[currentVariant.id];
          var priceStr2 = vPrices ? vPrices.price : formatMoney(currentVariant.price);
          var cp = currentVariant.compare_at_price;
          if (cp && cp > currentVariant.price) {
            var comparePrice = vPrices && vPrices.compare_at_price
              ? vPrices.compare_at_price
              : formatMoney(cp);
            priceEl.innerHTML = '<s class="drift-qa__compare">' + comparePrice + '</s> ' + priceStr2;
          } else {
            priceEl.innerHTML = priceStr2;
          }
        }
        // BUG-013: pre-order is a label override only when variant is
        // available; sold-out variants still show "Sold Out" and disable.
        if (currentVariant.available) {
          if (atcText) atcText.textContent = qaIsPreorder ? qaPreorderText : 'Add to Cart';
          if (atcBtn) atcBtn.disabled = false;
        } else {
          if (atcText) atcText.textContent = 'Sold Out';
          if (atcBtn) atcBtn.disabled = true;
        }
      }
    }
  }

  /* ========================================
     ATC — AJAX add to cart
     ======================================== */

  if (atcBtn) {
    atcBtn.addEventListener('click', function () {
      if (!currentVariant || atcBtn.disabled) return;

      var origText = atcText ? atcText.textContent : 'Add to Cart';
      atcBtn.disabled = true;
      if (atcText) atcText.textContent = 'Adding...';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: currentVariant.id, quantity: 1 }] })
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Add failed');
          return r.json();
        })
        .then(function () {
          atcBtn.disabled = false;
          if (atcText) atcText.textContent = origText;
          close();
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

  if (selectBtn) {
    selectBtn.addEventListener('click', function () {
      var firstOpt = variantsWrap.querySelector('.drift-qa__option-btn');
      if (firstOpt) firstOpt.focus();
    });
  }

  /* ========================================
     MOBILE PANEL — swipe down to close
     ======================================== */

  document.addEventListener('touchstart', function (e) {
    if (!isOpen || window.innerWidth >= DESKTOP_BP) return;
    if (!infoEl || !infoEl.contains(e.target)) return;
    var t = e.touches[0];
    dragState = {
      startY: t.clientY,
      currentY: t.clientY,
      startTime: Date.now(),
      locked: false
    };
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!dragState || !isOpen || window.innerWidth >= DESKTOP_BP) return;
    var t = e.touches[0];
    dragState.currentY = t.clientY;
    var dy = dragState.currentY - dragState.startY;

    if (dy > 0 && infoEl.scrollTop <= 0) {
      e.preventDefault();
      infoEl.style.transition = 'none';
      infoEl.style.transform = 'translateY(' + dy + 'px)';
      dragState.locked = true;
    }
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!dragState || !isOpen || window.innerWidth >= DESKTOP_BP) return;
    var dy = dragState.currentY - dragState.startY;
    var elapsed = Date.now() - dragState.startTime;
    var velocity = Math.abs(dy) / elapsed;
    var fast = velocity > 0.3;

    if (infoEl) infoEl.style.transition = '';

    if (!dragState.locked) {
      dragState = null;
      return;
    }

    if (dy > DRAG_THRESHOLD || (fast && dy > 20)) {
      close();
    } else {
      infoEl.style.transform = '';
    }

    dragState = null;
  }, { passive: true });

  /* ========================================
     EVENT LISTENERS
     ======================================== */

  if (bk) bk.addEventListener('click', close);

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-quick-add-trigger]');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();

    var layout = 'grid';
    if (trigger.closest('[data-collection-view="feed"]') || trigger.closest('.drift-feed')) {
      layout = 'feed';
    }

    var url = trigger.getAttribute('data-product-url');
    var productId = trigger.getAttribute('data-product-id');
    var preorderConfig = {
      isPreorder: trigger.getAttribute('data-preorder') === 'true',
      preorderText: trigger.getAttribute('data-preorder-text') || 'Pre-Order'
    };

    /* Look up Liquid-rendered prices for this product from the DOM */
    var pagePrices = null;
    if (productId) {
      var pricesEl = document.querySelector('[data-qa-prices-for="' + productId + '"]');
      if (pricesEl) {
        try { pagePrices = JSON.parse(pricesEl.textContent); } catch (err) {}
      }
    }

    if (url) open(url, layout, pagePrices, preorderConfig);
  });

  /* ========================================
     UTILITIES
     ======================================== */

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

  function escHtml(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function getSizedImage(url, size) {
    if (!url) return '';
    return url.replace(/(\.\w{3,4})(\?.*)?\s*$/, '_' + size + '$1$2');
  }

})();