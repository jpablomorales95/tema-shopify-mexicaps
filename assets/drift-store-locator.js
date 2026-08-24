/* ============================================
   DRIFT Theme — Store Locator
   OpenStreetMap + Leaflet.js (100% gratuito)
   CartoDB Dark Matter tiles para modo oscuro
   ============================================ */

(function () {
  'use strict';

  function toRad(v) { return (v * Math.PI) / 180; }

  function distanceKm(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function currentMode() {
    return document.documentElement.getAttribute('data-drift-mode') === 'dark' ||
      document.body.getAttribute('data-drift-mode') === 'dark'
      ? 'dark' : 'light';
  }

  var TILES = {
    dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  };
  var TILES_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

  var leafletLoadPromise = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletLoadPromise) return leafletLoadPromise;
    leafletLoadPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      var script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return leafletLoadPromise;
  }

  function pinIcon(color, size) {
    var s = size || 28;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 20 20">' +
      '<path fill="' + color + '" fill-rule="evenodd" d="m9.91 18.59 5.036-8.78c2.228-3.886-.525-8.777-4.942-8.777-4.385 0-7.147 4.822-4.992 8.713z"/>' +
      '<circle cx="10" cy="7" r="3" fill="rgba(0,0,0,0.6)"/>' +
      '</svg>';
    return L.divIcon({
      html: svg,
      className: 'drift-locator-gm-pin',
      iconSize: [s, s],
      iconAnchor: [s / 2, s],
      popupAnchor: [0, -s],
    });
  }

  function DriftLocator(root) {
    this.root = root;
    var dataEl = root.querySelector('[data-locator-stores]');
    try { this.stores = dataEl ? JSON.parse(dataEl.textContent) : []; }
    catch (e) { this.stores = []; }

    this.styleSetting = root.getAttribute('data-map-style') || 'auto';
    this.zoom = parseInt(root.getAttribute('data-map-zoom'), 10) || 13;

    this.activeCity = '';
    this.activeIndex = this.stores.length ? 0 : -1;
    this.userLoc = null;

    this.map = null;
    this.tileLayer = null;
    this.markers = [];

    this.els = {
      count:       root.querySelector('[data-locator-count]'),
      scope:       root.querySelector('[data-locator-scope]'),
      globeLabel:  root.querySelector('[data-locator-globe-label]'),
      name:        root.querySelector('[data-locator-name]'),
      address:     root.querySelector('[data-locator-address]'),
      distance:    root.querySelector('[data-locator-distance]'),
      hours:       root.querySelector('[data-locator-hours]'),
      directions:  root.querySelector('[data-locator-directions]'),
      statusLabel: root.querySelector('[data-locator-status-label]'),
      status:      root.querySelector('[data-locator-status]'),
      image:       root.querySelector('[data-locator-image]'),
      tabs:        root.querySelectorAll('[data-locator-tab]'),
      rows:        root.querySelectorAll('[data-locator-store]'),
      locateBtn:   root.querySelector('[data-locator-locate]'),
      mapEl:       root.querySelector('[data-locator-map]'),
      mapFallback: root.querySelector('[data-locator-map-fallback]'),
      mapNote:     root.querySelector('.drift-locator__map-note'),
    };

    this.bindEvents();
    this.renderDetail();
    this.initMap();
    this.watchThemeMode();
  }

  DriftLocator.prototype.bindEvents = function () {
    var self = this;

    this.els.tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        self.els.tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        self.activeCity = tab.getAttribute('data-locator-tab') || '';
        self.filterList();
      });
    });

    this.els.rows.forEach(function (row) {
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-index'), 10);
        self.selectStore(idx, true);
      });
    });

    if (this.els.locateBtn) {
      this.els.locateBtn.addEventListener('click', function () { self.locate(); });
    }
  };

  DriftLocator.prototype.filterList = function () {
    var self = this;
    var visibleCount = 0;
    this.els.rows.forEach(function (row) {
      var city = row.getAttribute('data-city') || '';
      var show = !self.activeCity || city === self.activeCity;
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    if (this.els.count) this.els.count.textContent = visibleCount;
    if (this.els.scope) {
      this.els.scope.textContent = this.activeCity
        ? 'en ' + this.activeCity
        : 'en todas las ciudades';
    }
    this.markers.forEach(function (m) {
      var visible = !self.activeCity || m.store.city === self.activeCity;
      if (visible) { m.marker.addTo(self.map); }
      else { m.marker.remove(); }
    });
  };

  DriftLocator.prototype.selectStore = function (index, userInitiated) {
    var store = this.stores[index];
    if (!store) return;
    this.activeIndex = index;

    this.els.rows.forEach(function (row) {
      row.classList.toggle('is-active', parseInt(row.getAttribute('data-index'), 10) === index);
    });

    this.renderDetail();

    if (this.map && this.markers[index]) {
      this.map.panTo([parseFloat(store.lat), parseFloat(store.lng)]);
      if (userInitiated) this.map.setZoom(Math.max(this.map.getZoom(), this.zoom));
      this.highlightMarker(index);
    }
  };

  DriftLocator.prototype.renderDetail = function () {
    var store = this.stores[this.activeIndex];
    if (!store) return;
    var e = this.els;

    if (e.name) e.name.textContent = store.name || 'Tienda';
    if (e.address) e.address.textContent = store.address || '';
    if (e.hours) e.hours.textContent = store.hours || '—';

    var closed = store.status === 'closed';
    if (e.statusLabel) e.statusLabel.textContent = closed ? 'Cerrado' : 'Abierto';
    if (e.status) e.status.classList.toggle('is-closed', closed);

    if (e.directions) {
      var url = store.directionsUrl ||
        (store.lat && store.lng
          ? 'https://www.google.com/maps/dir/?api=1&destination=' + store.lat + ',' + store.lng
          : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((store.name || '') + ' ' + (store.address || '')));
      e.directions.setAttribute('href', url);
    }

    if (e.image && store.image) {
      e.image.style.backgroundImage = 'url(' + store.image + ')';
      var ph = e.image.querySelector('.drift-locator__image-placeholder');
      if (ph) ph.style.display = 'none';
    }

    if (e.distance) {
      if (this.userLoc && store.lat && store.lng) {
        var d = distanceKm(this.userLoc.lat, this.userLoc.lng, parseFloat(store.lat), parseFloat(store.lng));
        e.distance.textContent = d !== null ? d.toFixed(1) + ' km' : '—';
      } else {
        e.distance.textContent = '—';
      }
    }

    if (e.globeLabel) {
      e.globeLabel.textContent = (store.name || '').replace(/^MEXICAPS\s*[–-]\s*/i, '');
    }
  };

  DriftLocator.prototype.locate = function () {
    var self = this;
    if (!navigator.geolocation) return;
    if (this.els.globeLabel) this.els.globeLabel.textContent = 'Buscando tienda…';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        self.userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        var nearestIndex = -1;
        var nearestDist = Infinity;
        self.stores.forEach(function (store, i) {
          if (!store.lat || !store.lng) return;
          var d = distanceKm(self.userLoc.lat, self.userLoc.lng, parseFloat(store.lat), parseFloat(store.lng));
          if (d !== null && d < nearestDist) { nearestDist = d; nearestIndex = i; }
        });
        if (nearestIndex > -1) self.selectStore(nearestIndex, true);

        if (self.map) {
          self.map.panTo([self.userLoc.lat, self.userLoc.lng]);
          L.circleMarker([self.userLoc.lat, self.userLoc.lng], {
            radius: 8,
            fillColor: '#4D8DFF',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
          }).addTo(self.map).bindPopup('Tu ubicación');
        }
      },
      function () {
        if (self.els.globeLabel && self.stores[self.activeIndex]) {
          self.els.globeLabel.textContent = (self.stores[self.activeIndex].name || '').replace(/^MEXICAPS\s*[–-]\s*/i, '');
        }
      }
    );
  };

  DriftLocator.prototype.tileUrl = function () {
    if (this.styleSetting === 'dark') return TILES.dark;
    if (this.styleSetting === 'light') return TILES.light;
    return currentMode() === 'dark' ? TILES.dark : TILES.light;
  };

  DriftLocator.prototype.initMap = function () {
    var self = this;
    if (!this.els.mapEl || !this.stores.length) return;

    loadLeaflet().then(function () {
      var first = self.stores[0];
      var center = [parseFloat(first.lat) || 4.6, parseFloat(first.lng) || -74.08];

      self.map = L.map(self.els.mapEl, {
        center: center,
        zoom: self.zoom,
        zoomControl: true,
        attributionControl: true,
      });

      self.tileLayer = L.tileLayer(self.tileUrl(), {
        attribution: TILES_ATTR,
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(self.map);

      self.stores.forEach(function (store, i) {
        if (!store.lat || !store.lng) return;
        var isActive = i === self.activeIndex;
        var marker = L.marker(
          [parseFloat(store.lat), parseFloat(store.lng)],
          { icon: pinIcon(isActive ? '#39FF6A' : '#C8C8CC', isActive ? 32 : 22) }
        ).addTo(self.map);

        marker.on('click', function () { self.selectStore(i, true); });
        self.markers.push({ marker: marker, store: store });
      });

      if (self.els.mapFallback) self.els.mapFallback.classList.add('is-hidden');

    }).catch(function () {
      if (self.els.mapNote) {
        self.els.mapNote.textContent = 'No se pudo cargar el mapa. Verifica tu conexión a internet.';
      }
    });
  };

  DriftLocator.prototype.highlightMarker = function (index) {
    this.markers.forEach(function (m, i) {
      m.marker.setIcon(pinIcon(i === index ? '#39FF6A' : '#C8C8CC', i === index ? 32 : 22));
    });
  };

  DriftLocator.prototype.watchThemeMode = function () {
    var self = this;
    if (this.styleSetting !== 'auto' || !window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      if (self.map && self.tileLayer) {
        self.tileLayer.setUrl(self.tileUrl());
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-drift-mode'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-drift-mode'] });
  };

  function init() {
    document.querySelectorAll('[data-drift-locator]').forEach(function (root) {
      if (root.__driftLocatorInit) return;
      root.__driftLocatorInit = true;
      new DriftLocator(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();