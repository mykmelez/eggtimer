/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */


(function (self) {
  'use strict';

  // On install, cache resources and skip waiting so the worker won't
  // wait for clients to be closed before becoming active.
  self.addEventListener('install', event =>
    event.waitUntil(
      oghliner.cacheResources()
      .then(() => self.skipWaiting())
    )
  );

  // On activation, delete old caches and start controlling the clients
  // without waiting for them to reload.
  self.addEventListener('activate', event =>
    event.waitUntil(
      oghliner.clearOtherCaches()
      .then(() => self.clients.claim())
    )
  );

  // Retrieves the request following oghliner strategy.
  self.addEventListener('fetch', event => {
    if (event.request.method === 'GET') {
      event.respondWith(oghliner.get(event.request));
    } else {
      event.respondWith(self.fetch(event.request));
    }
  });

  var oghliner = self.oghliner = {

    // This is the unique prefix for all the caches controlled by this worker.
    CACHE_PREFIX: 'offline-cache:mykmelez/eggtimer:' + (self.registration ? self.registration.scope : '') + ':',

    // This is the unique name for the cache controlled by this version of the worker.
    get CACHE_NAME() {
      return this.CACHE_PREFIX + 'cb759b8e2aab092c8e569be4064b31ea625796a2';
    },

    // This is a list of resources that will be cached.
    RESOURCES: [
      './index.html', // eaaf8c482e41b792677b2eae6413f8f8b9346670
      './css/index.css', // 037dd2cfac26017bafd00085121e818eca059393
      './js/index.js', // 1ebe9a43521b8adf07620174527dee080d99fe3f
      './js/offline-manager.js', // e2e09e000c5b64035940ae44e9c0936eb25ecd51
      './favicon/android-chrome-144x144.png', // 3b5d96cc1a852daba853e70afa4422fdce66ff13
      './favicon/android-chrome-192x192.png', // b1b04106f9107e40b26728b285b4e6983b8cd217
      './favicon/android-chrome-36x36.png', // c10f72cdbd4e241c2ce208d63b97f32b0ddc146e
      './favicon/android-chrome-48x48.png', // d443b1563b6e8e731619ac4be224d4e6f0f6bcec
      './favicon/android-chrome-72x72.png', // 9b6f949a972d39b220a5751e4b9bf4f46697e909
      './favicon/android-chrome-96x96.png', // b543cfd08138ba8824e708322c840a34e834eb14
      './favicon/apple-touch-icon-114x114.png', // 26d42de151e2011b72be6b7ff745aac64f4dad13
      './favicon/apple-touch-icon-120x120.png', // 3cb34262ccc3077ca8aaa5d4e263ba9c4dc82045
      './favicon/apple-touch-icon-144x144.png', // 53fc77d3e353d2facc2ce6e703744b985a87ad94
      './favicon/apple-touch-icon-152x152.png', // 7c5fb3aed2cbbc5fab91fb0a42d449c6496e5762
      './favicon/apple-touch-icon-180x180.png', // d9f38d2c03e5d6d3c2cccc3232396b08b2793d34
      './favicon/apple-touch-icon-57x57.png', // d0072a8374f5e8086274913e732dea8e0f5e020c
      './favicon/apple-touch-icon-60x60.png', // 9c1d36663ccb092a963325e6ef94a27310af9f08
      './favicon/apple-touch-icon-72x72.png', // 5b9d842efdd7f9e8967d5f97d9302e435482f62a
      './favicon/apple-touch-icon-76x76.png', // 8154389698072b351cac6c70e95bfaacb58b2813
      './favicon/apple-touch-icon-precomposed.png', // 0ea7d8f5c6b4cbe2c4649d7552fa81cc813676d5
      './favicon/apple-touch-icon.png', // d9f38d2c03e5d6d3c2cccc3232396b08b2793d34
      './favicon/browserconfig.xml', // 00b510a2fce91ebabc32505ceea8cfe13336950e
      './favicon/favicon-16x16.png', // 1a0255f4c91e2ef5ea79bdeb95eb4be18cba004f
      './favicon/favicon-194x194.png', // 835b5b75b2ea63b9352b5b7491085c8857257a67
      './favicon/favicon-32x32.png', // 66e4e15bb4f659d1fc485f125cc7c85d4a503412
      './favicon/favicon-96x96.png', // 9b45321ad5ab4b1ee28ef87f1440696cf070fc7f
      './favicon/favicon.ico', // ef12f58ee036ac192a1e58cdbdcd83dd6376547d
      './favicon/manifest.json', // 2a2a237c155898b42a3ff46ed298bbe4865a57e5
      './favicon/mstile-144x144.png', // fc301b91b821c9bec7a69aadecc4801bb3b592df
      './favicon/mstile-150x150.png', // df60755bea2ebaf57fe4bd9b6e6b086e5ae7b6d9
      './favicon/mstile-310x150.png', // b52547de5fbc0a9b2aedfbfa87602a6ace1eb84f
      './favicon/mstile-310x310.png', // 2c296befd44135699244501d1fdd59b2df40f4dc
      './favicon/mstile-70x70.png', // 353345ccc28c64b47653f21c031acb677278c3f6

    ],

    // Adds the resources to the cache controlled by this worker.
    cacheResources: function () {
      var now = Date.now();
      var baseUrl = self.location;
      return this.prepareCache()
      .then(cache => Promise.all(this.RESOURCES.map(resource => {
        // Bust the request to get a fresh response
        var url = new URL(resource, baseUrl);
        var bustParameter = (url.search ? '&' : '') + '__bust=' + now;
        var bustedUrl = new URL(url.toString());
        bustedUrl.search += bustParameter;

        // But cache the response for the original request
        var requestConfig = { credentials: 'same-origin' };
        var originalRequest = new Request(url.toString(), requestConfig);
        var bustedRequest = new Request(bustedUrl.toString(), requestConfig);
        return fetch(bustedRequest)
        .then(response => {
          if (response.ok) {
            return cache.put(originalRequest, response);
          }
          console.error('Error fetching ' + url + ', status was ' + response.status);
        });
      })));
    },

    // Remove the offline caches not controlled by this worker.
    clearOtherCaches: function () {
      var outOfDate = cacheName => cacheName.startsWith(this.CACHE_PREFIX) && cacheName !== this.CACHE_NAME;

      return self.caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
        .filter(outOfDate)
        .map(cacheName => self.caches.delete(cacheName))
      ));
    },

    // Get a response from the current offline cache or from the network.
    get: function (request) {
      return this.openCache()
      .then(cache => cache.match(() => this.extendToIndex(request)))
      .then(response => {
        if (response) {
          return response;
        }
        return self.fetch(request);
      });
    },

    // Make requests to directories become requests to index.html
    extendToIndex: function (request) {
      var url = new URL(request.url, self.location);
      var path = url.pathname;
      if (path[path.length - 1] !== '/') {
        return request;
      }
      url.pathname += 'index.html';
      return new Request(url.toString(), request);
    },

    // Prepare the cache for installation, deleting it before if it already exists.
    prepareCache: function () {
      return self.caches.delete(this.CACHE_NAME)
      .then(() => this.openCache());
    },

    // Open and cache the offline cache promise to improve the performance when
    // serving from the offline-cache.
    openCache: function () {
      if (!this._cache) {
        this._cache = self.caches.open(this.CACHE_NAME);
      }
      return this._cache;
    }

  };
}(self));
