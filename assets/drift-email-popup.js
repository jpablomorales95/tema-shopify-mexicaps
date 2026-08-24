/* ============================================
   DRIFT Theme by WEBEXP, LLC
   Email Capture Popup — Time-delayed modal
   V3: Discount Code Copy-to-Clipboard
   https://webexp.dev
   ============================================ */

(function () {
  'use strict';

  var COOKIE_NAME = 'drift_popup_dismissed';
  var SUCCESS_KEY = 'drift_popup_success';

  /* ── DOM ── */
  var popup = document.querySelector('[data-email-popup]');
  if (!popup) return;

  var backdrop = popup.querySelector('[data-popup-backdrop]');
  var closeBtn = popup.querySelector('[data-popup-close]');
  var formState = popup.querySelector('[data-popup-form-state]');
  var successState = popup.querySelector('[data-popup-success-state]');
  var emailInput = popup.querySelector('[data-popup-email]');
  var form = popup.querySelector('#drift-popup-form');
  var discountBtn = popup.querySelector('[data-popup-discount-code]');
  var discountCopied = popup.querySelector('[data-popup-discount-copied]');

  var delay = (parseInt(popup.getAttribute('data-popup-delay'), 10) || 5) * 1000;
  var cookieDays = parseInt(popup.getAttribute('data-popup-cookie-days'), 10) || 7;
  var hasDiscount = !!discountBtn;

  /* ── Cookie helpers ── */
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  /* ── Don't show in theme editor ── */
  if (window.Shopify && window.Shopify.designMode) return;

  /* ── Check if returning from form submit ── */
  var returningFromSubmit = false;
  try {
    if (localStorage.getItem(SUCCESS_KEY)) {
      returningFromSubmit = true;
      localStorage.removeItem(SUCCESS_KEY);
    }
  } catch (e) { /* private browsing */ }

  /* ── If already dismissed and NOT returning from submit, bail ── */
  if (getCookie(COOKIE_NAME) && !returningFromSubmit) return;

  /* ── Open / Close ── */
  function open(asSuccess) {
    if (asSuccess) {
      if (formState) formState.setAttribute('hidden', '');
      if (successState) successState.removeAttribute('hidden');
    }
    popup.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!asSuccess && emailInput) emailInput.focus();

    /* Auto-close after 5s if success state with no discount */
    if (asSuccess && !hasDiscount) {
      setTimeout(function () { close(true); }, 5000);
    }
  }

  function close(isSubscribed) {
    popup.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (!getCookie(COOKIE_NAME)) {
      setCookie(COOKIE_NAME, '1', isSubscribed ? 365 : cookieDays);
    }
  }

  /* ── Event listeners ── */
  if (closeBtn) closeBtn.addEventListener('click', function () { close(returningFromSubmit); });
  if (backdrop) backdrop.addEventListener('click', function () { close(returningFromSubmit); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && popup.getAttribute('aria-hidden') === 'false') {
      close(returningFromSubmit);
    }
  });

  /* ── Form submission — set flags then let native submit proceed ── */
  if (form) {
    form.addEventListener('submit', function () {
      /* Flag so popup reopens in success state after page reload */
      try { localStorage.setItem(SUCCESS_KEY, '1'); } catch (e) { /* silent */ }

      /* Set 1-year subscriber cookie */
      setCookie(COOKIE_NAME, '1', 365);

      /* No preventDefault — native submit + captcha proceed normally */
    });
  }

  /* ── Discount code — copy to clipboard ── */
  if (discountBtn) {
    discountBtn.addEventListener('click', function () {
      var code = discountBtn.getAttribute('data-popup-discount-code');
      if (!code) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(onCopied).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var tmp = document.createElement('textarea');
        tmp.value = code;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); } catch (e) { /* silent */ }
        document.body.removeChild(tmp);
        onCopied();
      }

      function onCopied() {
        discountBtn.classList.add('is-copied');
        if (discountCopied) discountCopied.removeAttribute('hidden');

        setTimeout(function () {
          discountBtn.classList.remove('is-copied');
          if (discountCopied) discountCopied.setAttribute('hidden', '');
        }, 2500);
      }
    });
  }

  /* ── Trigger ── */
  if (returningFromSubmit) {
    open(true);
  } else {
    setTimeout(function () { open(false); }, delay);
  }

})();