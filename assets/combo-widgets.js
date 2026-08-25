/* ============================================
   Combo Widgets — Mix and Match
   Vanilla JS, sigue el patrón de drift-product.js
   ============================================ */
(function () {
  'use strict';

  function initMixMatch(widget) {
    var setPriceCents = parseInt(widget.getAttribute('data-combo-set-price'), 10);
    var setQty = parseInt(widget.getAttribute('data-combo-set-qty'), 10) || 3;
    var anchorVariantId = widget.getAttribute('data-combo-anchor-id');
    var anchorPrice = parseFloat(widget.getAttribute('data-combo-anchor-price')) || 0;
    var isStandalone = widget.getAttribute('data-combo-mode') === 'standalone';
    var comboMarker = widget.getAttribute('data-combo-marker') || '';
    var redirectToCheckout = widget.getAttribute('data-combo-redirect-checkout') === 'true';

    var root = widget.closest('[data-section-id]') || document;
    var picker = root.querySelector('[data-combo-picker]');
    var variantModal = root.querySelector('[data-combo-variant]');
    var poolScript = root.querySelector('[data-combo-pool]');
    var pool = null;
    if (poolScript) {
      try { pool = JSON.parse(poolScript.textContent); } catch (e) { pool = []; }
    }
    var slotsWrap = widget.querySelector('[data-combo-slots]');
    var progressFill = widget.querySelector('[data-combo-progress-fill]');
    var progressCount = widget.querySelector('[data-combo-progress-count]');
    var pricingBlock = widget.querySelector('[data-combo-pricing]');
    var priceNormalEl = widget.querySelector('[data-combo-price-normal]');
    var priceFinalEl = widget.querySelector('[data-combo-price-final]');
    var priceSaveEl = widget.querySelector('[data-combo-price-save]');
    var submitBtn = widget.querySelector('[data-combo-submit]');
    var submitText = widget.querySelector('[data-combo-submit-text]');

    // selections[i] = { variantId, price, title, image, productHandle }
    var selections = {};
    var activeSlotIndex = null;

    function formatMoney(cents) {
      var rate = (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.rate)
        ? parseFloat(Shopify.currency.rate) : 1;
      var currencyCode = (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.active)
        ? Shopify.currency.active : 'USD';
      var amount = (cents * rate) / 100;
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency', currency: currencyCode,
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2
        }).format(amount);
      } catch (e) {
        return '$' + amount.toFixed(0);
      }
    }

    function updateProgress() {
      var filled = Object.keys(selections).length + (isStandalone ? 0 : 1); // +1 por el ancla, salvo standalone
      var pct = Math.round((filled / setQty) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressCount) progressCount.textContent = filled;

      var allFilled = filled >= setQty;
      submitBtn.disabled = !allFilled;

      var normalTotalCents = (isStandalone ? 0 : Math.round(anchorPrice)) + Object.keys(selections)
        .reduce(function (sum, k) { return sum + Math.round(selections[k].price); }, 0);

      if (filled > 0) {
        pricingBlock.hidden = false;
        priceNormalEl.textContent = formatMoney(normalTotalCents);
        priceFinalEl.textContent = formatMoney(setPriceCents);
        if (allFilled) {
          var saveCents = normalTotalCents - setPriceCents;
          if (saveCents > 0) {
            priceSaveEl.hidden = false;
            priceSaveEl.textContent = 'Ahorras ' + formatMoney(saveCents);
          } else {
            priceSaveEl.hidden = true;
          }
        } else {
          priceSaveEl.hidden = false;
          priceSaveEl.textContent = 'Llevas ' + formatMoney(normalTotalCents) + ' en precio normal';
        }
      } else {
        pricingBlock.hidden = true;
      }

      submitText.textContent = allFilled ? 'Agregar combo — ' + formatMoney(setPriceCents) : 'Completa tu combo';
    }

    function renderFilledSlot(slotEl, data) {
      slotEl.classList.remove('combo-slot--empty');
      slotEl.classList.add('combo-slot--filled');
      slotEl.setAttribute('data-combo-filled', 'true');
      slotEl.innerHTML =
        '<div class="combo-slot__thumb">' +
          (data.image ? '<img src="' + data.image + '" alt="" width="80" height="80" loading="lazy">' : '') +
        '</div>' +
        '<div class="combo-slot__info">' +
          '<span class="combo-slot__name">' + data.title + '</span>' +
          '<span class="combo-slot__variant">' +
            formatMoney(Math.round(data.price)) +
            (data.variantLabel ? ' · ' + data.variantLabel : '') +
          '</span>' +
        '</div>' +
        '<button type="button" class="combo-slot__remove" data-combo-remove aria-label="Quitar">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>';

      slotEl.querySelector('[data-combo-remove]').addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = slotEl.getAttribute('data-combo-slot');
        delete selections[idx];
        resetSlotToEmpty(slotEl, idx);
        updateProgress();
      });
    }

    function resetSlotToEmpty(slotEl, idx) {
      slotEl.classList.remove('combo-slot--filled');
      slotEl.classList.add('combo-slot--empty');
      slotEl.setAttribute('data-combo-filled', 'false');
      slotEl.innerHTML =
        '<span class="combo-slot__plus">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '</span>' +
        '<span class="combo-slot__cta">Agregar producto ' + (parseInt(idx, 10) + 1) + '</span>';
      slotEl.addEventListener('click', function () { openPicker(idx); });
    }

    function openPicker(slotIdx) {
      activeSlotIndex = slotIdx;
      picker.hidden = false;
      var input = picker.querySelector('[data-combo-picker-input]');
      var results = picker.querySelector('[data-combo-picker-results]');
      input.value = '';
      if (pool) {
        renderResultRows(results, pool);
      } else {
        results.innerHTML = '<p class="combo-picker__hint">Escribe para buscar productos.</p>';
      }
      setTimeout(function () { input.focus(); }, 50);
    }

    function closePicker() { picker.hidden = true; }

    function renderResultRows(results, products) {
      if (!products.length) {
        results.innerHTML = '<p class="combo-picker__hint">Sin resultados.</p>';
        return;
      }
      results.innerHTML = '';
      products.forEach(function (p) {
        if (p.available === false) return;
        // El pool (colección curada) trae precio numérico en centavos; la Search API
        // ya entrega el precio formateado como texto — cada uno se muestra a su modo.
        var priceLabel = typeof p.price === 'number' ? formatMoney(Math.round(p.price)) : p.price;
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'combo-picker__result';
        row.innerHTML =
          (p.image ? '<img src="' + p.image + '" alt="">' : '<span class="combo-picker__result-img-placeholder"></span>') +
          '<span class="combo-picker__result-info">' +
            '<span class="combo-picker__result-title">' + p.title + '</span>' +
            '<span class="combo-picker__result-price">' + priceLabel + '</span>' +
          '</span>';
        row.addEventListener('click', function () {
          closePicker();
          handleProductPicked(p.handle);
        });
        results.appendChild(row);
      });
      if (!results.children.length) {
        results.innerHTML = '<p class="combo-picker__hint">Sin resultados.</p>';
      }
    }

    var searchTimeout;
    function setupPickerSearch() {
      var input = picker.querySelector('[data-combo-picker-input]');
      var results = picker.querySelector('[data-combo-picker-results]');

      // Modo pool: la lista ya está en memoria (colección curada), se filtra localmente.
      if (pool) {
        input.addEventListener('input', function () {
          var q = input.value.trim().toLowerCase();
          var filtered = q.length
            ? pool.filter(function (p) { return p.title.toLowerCase().indexOf(q) !== -1; })
            : pool;
          renderResultRows(results, filtered);
        });
        return;
      }

      // Modo catálogo completo: búsqueda vía Search API.
      input.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        var q = input.value.trim();
        if (q.length < 2) {
          results.innerHTML = '<p class="combo-picker__hint">Escribe para buscar productos.</p>';
          return;
        }
        searchTimeout = setTimeout(function () {
          results.innerHTML = '<p class="combo-picker__hint">Buscando...</p>';
          fetch('/search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=product&resources[limit]=8&resources[options][unavailable_products]=hide')
            .then(function (r) { return r.json(); })
            .then(function (data) {
              var products = (data.resources && data.resources.results && data.resources.results.products) || [];
              renderResultRows(results, products);
            })
            .catch(function () {
              results.innerHTML = '<p class="combo-picker__hint">Error buscando productos.</p>';
            });
        }, 300);
      });
    }

    function handleProductPicked(handle) {
      fetch('/products/' + handle + '.js')
        .then(function (r) { return r.json(); })
        .then(function (product) {
          if (product.variants.length === 1) {
            assignSelection(activeSlotIndex, product, product.variants[0]);
          } else {
            openVariantPicker(product);
          }
        })
        .catch(function () {});
    }

    function openVariantPicker(product) {
      variantModal.hidden = false;
      var titleEl = variantModal.querySelector('[data-combo-variant-title]');
      var optionsWrap = variantModal.querySelector('[data-combo-variant-options]');
      var confirmBtn = variantModal.querySelector('[data-combo-variant-confirm]');
      titleEl.textContent = product.title;
      optionsWrap.innerHTML = '';
      var chosen = {};
      confirmBtn.disabled = true;

      product.options.forEach(function (optName, optIdx) {
        var group = document.createElement('div');
        var label = document.createElement('span');
        label.className = 'combo-variant__group-label';
        label.textContent = optName;
        group.appendChild(label);

        var valuesWrap = document.createElement('div');
        valuesWrap.className = 'combo-variant__values';

        var seen = {};
        product.variants.forEach(function (v) {
          var val = v.options[optIdx];
          if (seen[val]) return;
          seen[val] = true;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'combo-variant__value-btn';
          btn.textContent = val;
          btn.addEventListener('click', function () {
            valuesWrap.querySelectorAll('.combo-variant__value-btn').forEach(function (b) { b.classList.remove('is-active'); });
            btn.classList.add('is-active');
            chosen[optIdx] = val;
            var match = product.variants.find(function (v2) {
              return product.options.every(function (_, i) { return chosen[i] === undefined || v2.options[i] === chosen[i]; });
            });
            confirmBtn.disabled = !match || !match.available;
            confirmBtn.setAttribute('data-variant-id', match ? match.id : '');
          });
          valuesWrap.appendChild(btn);
        });
        group.appendChild(valuesWrap);
        optionsWrap.appendChild(group);
      });

      confirmBtn.onclick = function () {
        var variantId = confirmBtn.getAttribute('data-variant-id');
        var variant = product.variants.find(function (v) { return String(v.id) === String(variantId); });
        if (!variant) return;
        variantModal.hidden = true;
        assignSelection(activeSlotIndex, product, variant);
      };
    }

    function assignSelection(slotIdx, product, variant) {
      var variantLabel = variant.options.filter(function (opt) {
        return opt && opt.toLowerCase() !== 'default title';
      }).join(' / ');
      selections[slotIdx] = {
        variantId: variant.id,
        price: variant.price,
        title: product.title,
        image: product.featured_image ? product.featured_image.replace(/(\.[a-zA-Z]{3,4})$/, '_160x$1') : (product.images && product.images[0]),
        variantLabel: variantLabel
      };
      var slotEl = slotsWrap.querySelector('[data-combo-slot="' + slotIdx + '"]');
      renderFilledSlot(slotEl, {
        title: product.title,
        image: selections[slotIdx].image,
        price: variant.price,
        variantLabel: variantLabel
      });
      updateProgress();
    }

    // Bind empty slot clicks
    slotsWrap.querySelectorAll('[data-combo-filled="false"]').forEach(function (slotEl) {
      slotEl.addEventListener('click', function () {
        openPicker(slotEl.getAttribute('data-combo-slot'));
      });
    });

    setupPickerSearch();
    picker.querySelectorAll('[data-combo-picker-close]').forEach(function (el) {
      el.addEventListener('click', closePicker);
    });
    variantModal.querySelectorAll('[data-combo-variant-close]').forEach(function (el) {
      el.addEventListener('click', function () { variantModal.hidden = true; });
    });

    submitBtn.addEventListener('click', function () {
      if (submitBtn.disabled) return;
      var comboId = 'combo_' + Date.now();
      var baseProps = { '_combo_id': comboId, '_combo_set_price': (setPriceCents / 100).toFixed(2) };
      if (comboMarker) baseProps['_combo'] = comboMarker;

      var items = [];
      if (!isStandalone) {
        items.push({
          id: parseInt(anchorVariantId, 10),
          quantity: 1,
          properties: Object.assign({ '_combo_role': 'anchor' }, baseProps)
        });
      }
      Object.keys(selections).forEach(function (idx) {
        items.push({
          id: parseInt(selections[idx].variantId, 10),
          quantity: 1,
          properties: Object.assign({ '_combo_role': isStandalone ? 'member' : 'extra' }, baseProps)
        });
      });

      var origText = submitText.textContent;
      submitBtn.disabled = true;
      submitText.textContent = redirectToCheckout ? 'Preparando checkout...' : 'Agregando...';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: items })
      })
        .then(function (r) { if (!r.ok) throw new Error('fail'); return r.json(); })
        .then(function () {
          document.dispatchEvent(new CustomEvent('cart:updated'));
          if (redirectToCheckout) {
            window.location.href = '/checkout';
            return;
          }
          submitText.textContent = 'Agregado ✓';
          setTimeout(function () { submitText.textContent = origText; submitBtn.disabled = false; }, 1800);
        })
        .catch(function () {
          submitText.textContent = 'Error, intenta de nuevo';
          setTimeout(function () { submitText.textContent = origText; submitBtn.disabled = false; }, 1800);
        });
    });

    updateProgress();
  }

  function init() {
    document.querySelectorAll('[data-combo-widget="mixmatch"]').forEach(initMixMatch);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
