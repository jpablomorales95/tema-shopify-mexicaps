/* ============================================
   DRIFT Theme by WEBEXP, LLC
   https://webexp.dev
   YouTube: @WEBEXP | Instagram: @webexp.dev
   ============================================ */

/* ============================================
   1. COLOR MODE
   ============================================ */

const DriftMode = (() => {
  const KEY = 'drift-mode';
  const root = document.documentElement;

  function get() {
    return root.getAttribute('data-drift-mode') || 'light';
  }

  function set(mode) {
    root.setAttribute('data-drift-mode', mode);
    try { localStorage.setItem(KEY, mode); } catch (e) {}
  }

  function toggle() {
    set(get() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'dark' || stored === 'light') {
        set(stored);
        return;
      }
    } catch (e) {}
    if (!root.hasAttribute('data-drift-mode')) {
      set('light');
    }
  }

  return { get, set, toggle, init };
})();

/* ============================================
   2. HEADER
   ============================================ */

const DriftHeader = (() => {
  let header, menuBtn, drawer, backdrop, drawerLinks;
  let isOpen = false;
  let activeChildPanel = null;

  function open() {
    isOpen = true;
    header.setAttribute('data-menu-open', '');
    menuBtn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');

    const inlineNav = header.querySelector('[data-header-nav-inline]');
    if (inlineNav && window.innerWidth >= 1024) {
      inlineNav.style.transition = 'none';
      inlineNav.style.width = 'auto';
      inlineNav.style.overflow = 'visible';
      inlineNav.style.padding = '';
      const fullWidth = inlineNav.scrollWidth;

      inlineNav.style.width = '0px';
      inlineNav.style.overflow = 'hidden';
      inlineNav.style.padding = '0';
      inlineNav.offsetHeight;

      inlineNav.style.transition = 'width 500ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 300ms ease, padding 500ms cubic-bezier(0.25, 0.1, 0.25, 1)';
      inlineNav.style.width = fullWidth + 'px';
      inlineNav.style.opacity = '1';
      inlineNav.style.padding = '';

      function onEnd(e) {
        if (e.propertyName === 'width') {
          inlineNav.style.width = 'auto';
          inlineNav.style.overflow = 'visible';
          inlineNav.removeEventListener('transitionend', onEnd);
        }
      }
      inlineNav.addEventListener('transitionend', onEnd);

      const links = inlineNav.querySelectorAll('.drift-header__nav-link');
      links.forEach((link, i) => {
        const delay = 100 + i * 80;
        link.style.transition = `opacity 300ms ease ${delay}ms, transform 300ms ease ${delay}ms`;
        link.style.opacity = '1';
        link.style.transform = 'translateX(0)';

        setTimeout(() => {
          link.style.transition = '';
          link.style.opacity = '';
          link.style.transform = '';
          link.classList.add('drift-header__nav-link--visible');
        }, delay + 300);
      });
    }

    drawerLinks.forEach(l => l.setAttribute('tabindex', '0'));

    setTimeout(() => {
      const first = drawer.querySelector('a, button');
      if (first) first.focus();
    }, 100);
  }

  function close() {
    isOpen = false;

    closeChildPanel();

    const inlineNav = header.querySelector('[data-header-nav-inline]');
    if (inlineNav && window.innerWidth >= 1024) {
      const currentWidth = inlineNav.scrollWidth;
      inlineNav.style.transition = 'none';
      inlineNav.style.width = currentWidth + 'px';
      inlineNav.style.overflow = 'hidden';
      inlineNav.offsetHeight;

      inlineNav.style.transition = 'width 400ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 200ms ease, padding 400ms cubic-bezier(0.25, 0.1, 0.25, 1)';
      inlineNav.style.width = '0px';
      inlineNav.style.opacity = '0';
      inlineNav.style.padding = '0';

      const links = inlineNav.querySelectorAll('.drift-header__nav-link');
      links.forEach(link => {
        link.classList.remove('drift-header__nav-link--visible');
        link.style.transition = 'opacity 200ms ease, transform 200ms ease';
        link.style.opacity = '0';
        link.style.transform = 'translateX(-10px)';
      });
    }

    header.removeAttribute('data-menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');

    drawerLinks.forEach(l => l.setAttribute('tabindex', '-1'));

    menuBtn.focus();
  }

  function toggle() {
    isOpen ? close() : open();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  }

  function handleBackdropClick(e) {
    if (isOpen) close();
  }

  function openChildPanel(panelId) {
    if (!drawer) return;
    const panel = drawer.querySelector(`[data-drawer-panel="${panelId}"]`);
    if (!panel) return;

    activeChildPanel = panel;
    drawer.setAttribute('data-child-open', '');
    panel.classList.add('is-active');

    panel.offsetHeight;
    panel.style.transform = 'translateX(0)';

    panel.querySelectorAll('a, button').forEach(el => el.setAttribute('tabindex', '0'));
  }

  function closeChildPanel() {
    if (!drawer || !activeChildPanel) return;

    drawer.removeAttribute('data-child-open');
    activeChildPanel.style.transform = '';
    activeChildPanel.classList.remove('is-active');

    activeChildPanel.querySelectorAll('a, button').forEach(el => el.setAttribute('tabindex', '-1'));
    activeChildPanel = null;
  }

  function init(section) {
    header = section || document.querySelector('.drift-header');
    if (!header) return;

    menuBtn = header.querySelector('[data-menu-toggle]');
    drawer = header.querySelector('[data-header-drawer]');
    backdrop = header.querySelector('[data-header-backdrop]');
    drawerLinks = drawer ? drawer.querySelectorAll('[data-drawer-panel="main"] a, [data-drawer-panel="main"] button') : [];

    if (menuBtn) menuBtn.addEventListener('click', toggle);
    if (backdrop) backdrop.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);

    header.querySelectorAll('[data-mode-toggle]').forEach(btn => {
      btn.addEventListener('click', () => DriftMode.toggle());
    });

    header.querySelectorAll('[data-submenu-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = btn.closest('[data-nav-parent]');
        const isOpen = parent.classList.contains('is-open');

        header.querySelectorAll('[data-nav-parent].is-open').forEach(p => {
          p.classList.remove('is-open');
          p.querySelector('[data-submenu-toggle]').setAttribute('aria-expanded', 'false');
          p.querySelector('[data-submenu]').setAttribute('aria-hidden', 'true');
        });

        if (!isOpen) {
          parent.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          parent.querySelector('[data-submenu]').setAttribute('aria-hidden', 'false');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-nav-parent]')) {
        header.querySelectorAll('[data-nav-parent].is-open').forEach(p => {
          p.classList.remove('is-open');
          p.querySelector('[data-submenu-toggle]').setAttribute('aria-expanded', 'false');
          p.querySelector('[data-submenu]').setAttribute('aria-hidden', 'true');
        });
      }
    });

    if (drawer) {
      drawer.querySelectorAll('[data-drawer-to]').forEach(btn => {
        btn.addEventListener('click', () => {
          openChildPanel(btn.getAttribute('data-drawer-to'));
        });
      });

      drawer.querySelectorAll('[data-drawer-back]').forEach(btn => {
        btn.addEventListener('click', closeChildPanel);
      });
    }
  }

  function destroy() {
    if (menuBtn) menuBtn.removeEventListener('click', toggle);
    if (backdrop) backdrop.removeEventListener('click', handleBackdropClick);
    document.removeEventListener('keydown', handleKeydown);
  }

  return { init, destroy, close };
})();

/* ============================================
   4. INIT
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  DriftMode.init();
  DriftHeader.init();
});

/* ============================================
   5. THEME EDITOR SAFETY
   ============================================ */

if (Shopify && Shopify.designMode) {
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target;
    if (section.querySelector('.drift-header')) {
      DriftHeader.init(section.querySelector('.drift-header'));
    }
  });

  document.addEventListener('shopify:section:unload', (e) => {
    const section = e.target;
    if (section.querySelector('.drift-header')) {
      DriftHeader.destroy();
    }
  });
}