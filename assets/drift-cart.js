/* ============================================
   DRIFT Theme by WEBEXP, LLC
   Cart Drawer — AJAX cart with dropdown panel
   V3: Cart Upsell / Cross-Sell
   https://webexp.dev
   ============================================ */

(function () {
  'use strict';

  /* ── DOM ── */
  var drawer = document.querySelector('[data-cart-drawer]');
  if (!drawer) return;

  var panel = drawer.querySelector('[data-cart-panel]');
  var backdrop = drawer.querySelector('[data-cart-backdrop]');
  var closeBtn = drawer.querySelector('[data-cart-close]');
  var itemsWrap = drawer.querySelector('[data-cart-items]');
  var subtotalEl = drawer.querySelector('[data-cart-subtotal]');
  var footerEl = drawer.querySelector('[data-cart-footer]');
  var checkoutBtn = drawer.querySelector('[data-cart-checkout]');

  /* Free shipping bar */
  var shippingBar = drawer.querySelector('[data-cart-shipping]');
  var shippingText = drawer.querySelector('[data-cart-shipping-text]');
  var shippingFill = drawer.querySelector('[data-cart-shipping-fill]');
  var shippingThreshold = shippingBar
    ? parseFloat(shippingBar.getAttribute('data-shipping-threshold')) || 0
    : 0;

  /* Upsell */
  var upsellWrap = drawer.querySelector('[data-cart-upsell]');
  var upsellToggle = drawer.querySelector('[data-cart-upsell-toggle]');
  var upsellBody = drawer.querySelector('[data-cart-upsell-body]');
  var upsellScroll = drawer.querySelector('[data-cart-upsell-scroll]');
  /* Default-expanded state is desktop-only. Mobile is always collapsed
     on open — cart space is too tight there to justify expanding the
     upsell automatically. Customers tap the heading to expand. */
  var upsellExpanded = false;
  if (upsellWrap) {
    var isDesktop = window.innerWidth >= 1025;
    if (isDesktop) {
      upsellExpanded = upsellWrap.getAttribute('data-upsell-default-expanded-desktop') === 'true';
    }
    if (upsellExpanded) {
      upsellWrap.classList.add('is-expanded');
      if (upsellToggle) upsellToggle.setAttribute('aria-expanded', 'true');
    }
  }
  var upsellLimit = upsellWrap
    ? parseInt(upsellWrap.getAttribute('data-upsell-limit'), 10) || 4
    : 4;
  var lastUpsellFingerprint = null;

  /* Cart bubble(s) in header */
  var cartBubbleLinks = document.querySelectorAll('[data-cart-bubble]');
  var cartCountEls = document.querySelectorAll('[data-cart-count]');

  /* ── State ── */
  var isOpen = false;
  var cart = null;
  var lastCartToken = null;
  var productCache = {};

  /* ========================================
     OPEN / CLOSE
     ======================================== */

  function open() {
    if (isOpen) return;
    isOpen = true;
    drawer.setAttribute('aria-hidden', 'false');
    if (window.innerWidth < 1025) {
      document.body.style.overflow = 'hidden';
    }
    var header = document.querySelector('.drift-header');
    if (header && header.hasAttribute('data-menu-open')) {
      header.removeAttribute('data-menu-open');
    }
    // BUG-009p: DRIFT's cart drawer is hidden via opacity:0 + transform,
    // NOT display:none. So the wallet web components render and measure
    // their initial layout while the drawer is invisible-but-still-laid-
    // out, then cache that measurement and never re-measure on opacity
    // change. Fire a window resize event on drawer open — Shopify's
    // accelerated checkout web components listen for it and recompute.
    patchWalletShadowDom();
    requestAnimationFrame(function () {
      window.dispatchEvent(new Event('resize'));
      patchWalletShadowDom();
    });
    setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
      patchWalletShadowDom();
    }, 100);
    setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
      patchWalletShadowDom();
    }, 500);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    drawer.setAttribute('aria-hidden', 'true');
    var pdpExpanded = document.querySelector('.drift-pdp__panel.is-expanded');
    if (!pdpExpanded) {
      document.body.style.overflow = '';
    }
  }

  function toggle() {
    if (isOpen) close();
    else {
      fetchAndRender();
      open();
    }
  }

  /* ========================================
     EVENT LISTENERS
     ======================================== */

  if (panel) {
    panel.addEventListener('touchmove', function (e) {
      if (!isOpen) return;
      var items = panel.querySelector('[data-cart-items]');
      if (!items) return;
      if (items.scrollHeight > items.clientHeight) {
        e.stopPropagation();
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });
  }

  if (backdrop) {
    backdrop.addEventListener('touchmove', function (e) {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  cartBubbleLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
  });

  document.addEventListener('cart:updated', function () {
    fetchAndRender();
    open();
  });

  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (panel && panel.contains(e.target)) return;
    var clickedBubble = false;
    cartBubbleLinks.forEach(function (link) {
      if (link.contains(e.target)) clickedBubble = true;
    });
    if (clickedBubble) return;
    close();
  });

  /* Upsell toggle */
  if (upsellToggle) {
    upsellToggle.addEventListener('click', function () {
      upsellExpanded = !upsellExpanded;
      upsellToggle.setAttribute('aria-expanded', upsellExpanded ? 'true' : 'false');
      if (upsellWrap) {
        if (upsellExpanded) upsellWrap.classList.add('is-expanded');
        else upsellWrap.classList.remove('is-expanded');
      }
    });
  }

  /* ========================================
     FETCH CART + RENDER
     ======================================== */

  function fetchAndRender() {
    Promise.all([
      fetch('/cart.js', { headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json(); }),
      fetch('/?sections=drift-cart-items', { headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json(); })
    ])
      .then(function (results) {
        cart = results[0];
        var sections = results[1] || {};
        renderCart(sections['drift-cart-items']);
        updateShippingBar();
        syncBubbles();
        fetchUpsell();
        patchWalletShadowDom();
        setTimeout(patchWalletShadowDom, 300);
        setTimeout(patchWalletShadowDom, 1200);
      })
      .catch(function () {});
  }

  /* BUG-009 / BUG-012 / BUG-012b: .wallet-cart-grid lives inside the
     accelerated-checkout web component's shadow DOM. External CSS can't
     reach it — we inject a <style> tag DIRECTLY into the shadow root.

     Mobile (≤749px): cap the row at 2 dynamic checkout buttons and split
     them 50/50. First 2 children with rendered content stay; everything
     past that is hidden. Avoids the "phantom space on the right" issue
     that came from 3-column grids with an empty 3rd host. Desktop keeps
     the 3-button row. */
  var WALLET_PATCH_VERSION = 'v19';
  function patchWalletShadowDom() {
    var hosts = document.querySelectorAll(
      'shopify-accelerated-checkout-cart, shopify-accelerated-checkout, shopify-payment-terms'
    );
    hosts.forEach(function (host) {
      if (!host.shadowRoot) return;

      // Inject base layout style if not already current.
      var existing = host.shadowRoot.querySelectorAll('[data-drift-wallet-patch]');
      var alreadyCurrent = false;
      existing.forEach(function (el) {
        if (el.getAttribute('data-drift-wallet-patch') === WALLET_PATCH_VERSION) {
          alreadyCurrent = true;
        } else {
          el.remove();
        }
      });
      if (!alreadyCurrent) {
        var style = document.createElement('style');
        style.setAttribute('data-drift-wallet-patch', WALLET_PATCH_VERSION);
        style.textContent =
          ':host,' +
          '.wallet-button-fade-in,' +
          '.wallet-button-wrapper,' +
          '.accelerated-checkout-button-container,' +
          '.wallet-cart-grid{' +
            'width:100% !important;' +
            'max-width:none !important;' +
            'box-sizing:border-box !important;' +
          '}' +
          '.wallet-cart-grid,' +
          '.wallet-cart-grid:not(.wallet-cart-grid--horizontal){' +
            'display:grid !important;' +
            'grid-auto-flow:column !important;' +
            'grid-auto-columns:1fr !important;' +
            'gap:6px !important;' +
            'margin:0 !important;' +
            'padding:0 !important;' +
            '--shopify-accelerated-checkout-inline-alignment:stretch !important;' +
            '--shopify-accelerated-checkout-row-gap:6px !important;' +
          '}' +
          '.wallet-cart-grid > *{' +
            'box-sizing:border-box !important;' +
            'min-width:0 !important;' +
            'max-width:none !important;' +
            'width:100% !important;' +
            'margin:0 !important;' +
          '}' +
          'apple-pay-button,' +
          'shopify-apple-pay-button,' +
          'apple-pay-button-element{' +
            'width:100% !important;' +
            'min-width:0 !important;' +
            'max-width:none !important;' +
            'display:block !important;' +
            'box-sizing:border-box !important;' +
            '--apple-pay-button-width:100% !important;' +
          '}' +
          /* Mobile: 2-column grid. Per-child show/hide is handled by
             applyMobileWalletLimit() — we keep the first 2 children with
             rendered content and hide the rest. */
          '@media (max-width:749px){' +
            '.wallet-cart-grid{' +
              'grid-template-columns:1fr 1fr !important;' +
              'grid-auto-flow:row !important;' +
            '}' +
          '}';
        host.shadowRoot.appendChild(style);
      }

      applyMobileWalletLimit(host);
      hideEmptyWallets(host);
      setupWalletObserver(host);
    });
  }

  /* On mobile, cap the wallet row at 2 buttons. Walk children in render
     order, keep the first 2 that have rendered content, hide everything
     else. No platform sniffing — whatever Shopify hands us first wins,
     which on iPhone today is Shop Pay + Apple Pay. */
  function applyMobileWalletLimit(host) {
    if (!host.shadowRoot) return;
    var grid = host.shadowRoot.querySelector('.wallet-cart-grid');
    if (!grid) return;

    var children = Array.prototype.slice.call(grid.children);
    var isMobile = window.innerWidth < 750;
    var MAX_MOBILE_BUTTONS = 2;

    if (!isMobile) {
      // Clear any inline styles we may have set during a prior mobile pass
      // so the desktop CSS rules win again.
      children.forEach(function (c) {
        if (c._driftMobileTouched) {
          c.style.removeProperty('display');
          c.style.removeProperty('width');
          c.style.removeProperty('grid-column');
          c._driftMobileTouched = false;
        }
      });
      return;
    }

    // A child counts as content-bearing if it has any rendered descendants.
    // Empty wallet hosts (e.g. Google Pay placeholder on iOS) have no
    // children and would otherwise claim a column for nothing.
    function hasContent(c) {
      return c.children && c.children.length > 0;
    }

    var kept = 0;
    children.forEach(function (c) {
      c._driftMobileTouched = true;
      if (hasContent(c) && kept < MAX_MOBILE_BUTTONS) {
        c.style.removeProperty('display');
        c.style.removeProperty('grid-column');
        c.style.setProperty('width', '100%', 'important');
        kept++;
      } else {
        c.style.setProperty('display', 'none', 'important');
      }
    });
  }

  /* Desktop: hide wallet wrappers that have no rendered content so they
     don't claim grid space and leave phantom gaps.

     BUG-012c: previously used querySelector('apple-pay-button, ...') which
     misses wallet elements that are DIRECT children of the wrapper (the
     same trap that bit BUG-012a). Result: every wrapper looked "empty"
     and got display:none — blank dynamic-buttons area on desktop. The
     simple children.length check matches the mobile logic and is robust
     against whatever element name Shopify uses. */
  function hideEmptyWallets(host) {
    if (!host.shadowRoot) return;
    if (window.innerWidth < 750) return; // mobile handled by applyMobileWalletLimit
    var wrappers = host.shadowRoot.querySelectorAll('.wallet-cart-grid > *');
    wrappers.forEach(function (w) {
      var isEmpty = !w.children || w.children.length === 0;
      if (isEmpty) {
        w.style.setProperty('display', 'none', 'important');
      } else if (w.style.display === 'none' && !w._driftMobileTouched) {
        w.style.removeProperty('display');
      }
    });
  }

  function setupWalletObserver(host) {
    if (!host.shadowRoot) return;
    if (host._driftWalletObserved) return;
    host._driftWalletObserved = true;
    try {
      var observer = new MutationObserver(function () {
        if (host._driftWalletPending) return;
        host._driftWalletPending = true;
        requestAnimationFrame(function () {
          host._driftWalletPending = false;
          applyMobileWalletLimit(host);
          hideEmptyWallets(host);
        });
      });
      observer.observe(host.shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'style', 'class']
      });
    } catch (e) {}
  }

  // Re-apply when viewport crosses the mobile breakpoint or orientation flips.
  window.addEventListener('resize', function () {
    var hosts = document.querySelectorAll(
      'shopify-accelerated-checkout-cart, shopify-accelerated-checkout, shopify-payment-terms'
    );
    hosts.forEach(function (host) {
      applyMobileWalletLimit(host);
      hideEmptyWallets(host);
    });
  });


  function renderCart(sectionHtml) {
    if (!cart || !itemsWrap) return;

    var token = cart.items.map(function (i) {
      return i.key + ':' + i.quantity;
    }).join(',') + '|' + cart.total_price;

    if (token === lastCartToken) return;
    lastCartToken = token;

    if (cart.item_count === 0) {
      itemsWrap.innerHTML = '<span class="drift-cart__empty">Cart is empty</span>';
      if (footerEl) footerEl.style.display = 'none';
      if (shippingBar) shippingBar.setAttribute('hidden', '');
      hideUpsell();
      return;
    }

    if (footerEl) footerEl.style.display = '';

    if (sectionHtml) {
      var temp = document.createElement('span');
      temp.innerHTML = sectionHtml;
      var renderItems = temp.querySelector('[data-cart-render-items]');
      var renderSubtotal = temp.querySelector('[data-cart-render-subtotal]');
      if (renderItems) {
        itemsWrap.innerHTML = renderItems.innerHTML;
      }
      if (subtotalEl && renderSubtotal) {
        subtotalEl.innerHTML = renderSubtotal.innerHTML;
      }
    }

    bindItemEvents();
  }

  /* ========================================
     FREE SHIPPING BAR
     ======================================== */

  function updateShippingBar() {
    if (!shippingBar || !shippingText || !shippingFill || !cart) return;
    if (shippingThreshold <= 0) return;

    if (cart.item_count === 0) {
      shippingBar.setAttribute('hidden', '');
      return;
    }

    shippingBar.removeAttribute('hidden');

    var totalDollars = cart.total_price / 100;
    var remaining = shippingThreshold - totalDollars;
    var pct = Math.min((totalDollars / shippingThreshold) * 100, 100);

    var currencyCode = (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.active)
      ? Shopify.currency.active
      : 'USD';

    if (remaining <= 0) {
      shippingBar.classList.add('is-met');
      shippingText.innerHTML = '<svg class="drift-cart__shipping-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Free shipping unlocked';
      shippingFill.style.width = '100%';
    } else {
      shippingBar.classList.remove('is-met');
      var formattedRemaining = formatCurrency(remaining, currencyCode);
      shippingText.textContent = 'You\u2019re ' + formattedRemaining + ' away from free shipping';
      shippingFill.style.width = pct + '%';
    }
  }

  function formatCurrency(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '$' + amount.toFixed(2);
    }
  }

  /* ========================================
     CART UPSELL / CROSS-SELL (V3)
     ======================================== */

  function fetchUpsell() {
    if (!upsellWrap || !upsellScroll || !cart || cart.item_count === 0) {
      hideUpsell();
      return;
    }

    var cartProductIds = cart.items.map(function (i) { return i.product_id; });
    var cartFingerprint = cartProductIds.slice().sort().join(',');

    if (cartFingerprint === lastUpsellFingerprint) return;
    lastUpsellFingerprint = cartFingerprint;

    var uniqueIds = [];
    cartProductIds.forEach(function (id) {
      if (uniqueIds.indexOf(id) === -1) uniqueIds.push(id);
    });

    var fetches = uniqueIds.map(function (id) {
      return fetch('/recommendations/products.json?product_id=' + id + '&limit=10&intent=related')
        .then(function (r) { return r.json(); })
        .then(function (data) { return data.products || []; })
        .catch(function () { return []; });
    });

    Promise.all(fetches).then(function (results) {
      var seen = {};
      var merged = [];

      results.forEach(function (products) {
        products.forEach(function (p) {
          if (seen[p.id]) return;
          if (cartProductIds.indexOf(p.id) !== -1) return;
          if (!p.available) return;
          seen[p.id] = true;
          merged.push(p);
        });
      });

      if (merged.length === 0) {
        hideUpsell();
        return;
      }

      for (var i = merged.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = merged[i];
        merged[i] = merged[j];
        merged[j] = tmp;
      }

      renderUpsell(merged.slice(0, upsellLimit));
    });
  }

  function renderUpsell(products) {
    if (!upsellScroll || !upsellWrap) return;

    var html = '';

    products.forEach(function (p) {
      var img = p.featured_image
        ? getSizedImage(p.featured_image, '400x')
        : '';
      var firstVariant = p.variants && p.variants[0] ? p.variants[0] : null;
      var hasMultipleVariants = p.variants && p.variants.length > 1;
      var variantId = firstVariant ? firstVariant.id : '';
      var price = firstVariant ? firstVariant.price : p.price;

      html += '<span class="drift-cart__upsell-card">';

      html += '<a href="' + p.url + '" class="drift-cart__upsell-img-link">';
      if (img) {
        html += '<img class="drift-cart__upsell-img" src="' + img + '" alt="' + escHtml(p.title) + '" loading="lazy" width="200" height="200" draggable="false">';
      }
      html += '</a>';

      html += '<span class="drift-cart__upsell-info">';
      html += '<a href="' + p.url + '" class="drift-cart__upsell-title">' + escHtml(p.title) + '</a>';
      var compareAt = firstVariant ? firstVariant.compare_at_price : null;
      var priceHtml = '';
      if (compareAt && compareAt > price) {
        priceHtml = '<s class="drift-cart__upsell-compare">' + formatMoney(compareAt) + '</s> ' + formatMoney(price);
      } else {
        priceHtml = formatMoney(price);
      }
      html += '<span class="drift-cart__upsell-price">' + priceHtml + '</span>';
      html += '</span>';

      if (hasMultipleVariants) {
        html += '<a href="' + p.url + '" class="drift-cart__upsell-options" aria-label="View options for ' + escHtml(p.title) + '">View</a>';
      } else if (variantId) {
        html += '<button class="drift-cart__upsell-add" data-upsell-add="' + variantId + '" type="button" aria-label="Add ' + escHtml(p.title) + ' to cart">Add to Cart</button>';
      }

      html += '</span>';
    });

    upsellScroll.innerHTML = html;
    upsellWrap.removeAttribute('hidden');

    bindUpsellEvents();
  }

  function bindUpsellEvents() {
    if (!upsellScroll) return;

    var addBtns = upsellScroll.querySelectorAll('[data-upsell-add]');
    addBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var variantId = btn.getAttribute('data-upsell-add');
        if (!variantId) return;

        btn.disabled = true;
        btn.classList.add('is-adding');

        fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ id: parseInt(variantId, 10), quantity: 1 })
        })
          .then(function (r) { return r.json(); })
          .then(function () {
            lastUpsellFingerprint = null;
            fetchAndRender();
          })
          .catch(function () {
            btn.disabled = false;
            btn.classList.remove('is-adding');
          });
      });
    });
  }

  function hideUpsell() {
    if (!upsellWrap) return;
    upsellWrap.setAttribute('hidden', '');
    if (upsellScroll) upsellScroll.innerHTML = '';
    lastUpsellFingerprint = null;
  }

  /* ========================================
     ITEM EVENTS — qty + remove
     ======================================== */

  function bindItemEvents() {
    var qtyBtns = itemsWrap.querySelectorAll('[data-cart-qty]');
    qtyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-line-key');
        var action = btn.getAttribute('data-cart-qty');
        var item = findItem(key);
        if (!item) return;

        var newQty = action === 'plus' ? item.quantity + 1 : item.quantity - 1;
        if (newQty < 1) newQty = 0;

        setItemUpdating(key, true);
        updateItem(key, newQty);
      });
    });

    var removeBtns = itemsWrap.querySelectorAll('[data-cart-remove]');
    removeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-line-key');
        setItemUpdating(key, true);
        updateItem(key, 0);
      });
    });
  }

  function findItem(key) {
    if (!cart) return null;
    return cart.items.find(function (i) { return i.key === key; }) || null;
  }

  function setItemUpdating(key, updating) {
    var el = itemsWrap.querySelector('[data-line-key="' + key + '"].drift-cart__item');
    if (!el) return;
    if (updating) el.classList.add('is-updating');
    else el.classList.remove('is-updating');
  }

  /* ========================================
     CART API — update quantity
     ======================================== */

  function updateItem(key, qty) {
    fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ id: key, quantity: qty, sections: 'drift-cart-items' })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        cart = data;
        lastCartToken = null;
        lastUpsellFingerprint = null;
        var sections = data.sections || {};
        renderCart(sections['drift-cart-items']);
        updateShippingBar();
        syncBubbles();
        fetchUpsell();

        if (cart.item_count === 0) {
          setTimeout(close, 300);
        }
      })
      .catch(function () {
        setItemUpdating(key, false);
      });
  }

  /* ========================================
     SYNC HEADER BUBBLES
     ======================================== */

  function syncBubbles() {
    if (!cart) return;

    cartCountEls.forEach(function (el) {
      el.textContent = cart.item_count;
    });

    cartBubbleLinks.forEach(function (link) {
      if (cart.item_count > 0) link.removeAttribute('hidden');
      else link.setAttribute('hidden', '');
    });
  }

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

  /* ========================================
     INIT — fetch cart state on page load
     ======================================== */

  fetchAndRender();

})();