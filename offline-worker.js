/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This generated service worker JavaScript will precache your site's resources.
// The code needs to be saved in a .js file at the top-level of your site, and registered
// from your pages in order to be used. See
// https://github.com/googlechrome/sw-precache/blob/master/demo/app/js/service-worker-registration.js
// for an example of how you can register this script and handle various service worker events.

'use strict';



var PrecacheConfig = [["css/index.css","898c39bc9ad7657e9549f9849d254dd5"],["favicon/android-chrome-144x144.png","55977723c23cade5948e7ea54c30f432"],["favicon/android-chrome-192x192.png","2f8b44101cf93c8756b825623f6cadf7"],["favicon/android-chrome-36x36.png","505a3e5f8f349b37d99719eea0dcee82"],["favicon/android-chrome-48x48.png","566feb9f62b14475ed47149cfeac95bc"],["favicon/android-chrome-72x72.png","9a786e8ec2dd57cd1af92f95eb1d1c66"],["favicon/android-chrome-96x96.png","adc3451ed08c84190eb2886908a9d66b"],["favicon/apple-touch-icon-114x114.png","978153c34c7f052847af738fdae874be"],["favicon/apple-touch-icon-120x120.png","d8f2a95598f6b65ade43529443a913a7"],["favicon/apple-touch-icon-144x144.png","248b38cd0957489272e65de6e4995d08"],["favicon/apple-touch-icon-152x152.png","b048936694550bf8da1106d8f6b6c5f1"],["favicon/apple-touch-icon-180x180.png","ac44b197f399dd65dfba624124a991ac"],["favicon/apple-touch-icon-57x57.png","98108f51ea3697bc473341c2d522b9f7"],["favicon/apple-touch-icon-60x60.png","84685a7225287f94b3151a0109aa6ffc"],["favicon/apple-touch-icon-72x72.png","7b36f661628e63d235910d8dfd8115f4"],["favicon/apple-touch-icon-76x76.png","a081394f17687c0b05b765072243d25b"],["favicon/apple-touch-icon-precomposed.png","85ead418566f180da7aa8ee16fbbd91a"],["favicon/apple-touch-icon.png","ac44b197f399dd65dfba624124a991ac"],["favicon/browserconfig.xml","ecf8f21c7aaec3133a29a16a8f0bfb57"],["favicon/favicon-16x16.png","bf63fc73494410b80cec3031194ac618"],["favicon/favicon-194x194.png","735cf7061406c6c097d863649c3b7598"],["favicon/favicon-32x32.png","2a33a1f073f2d53c6f2ff2aae2fab1cb"],["favicon/favicon-96x96.png","d60a5795d5ea64ced6247d88a0bb135d"],["favicon/favicon.ico","003763b9beaeb64bc1e0adf6e1443c9b"],["favicon/manifest.json","45ca79381809c2b75b0307868481277e"],["favicon/mstile-144x144.png","fdf45a44d2f2a28497a9afd531d99bff"],["favicon/mstile-150x150.png","584b9dcadcc9da11464a9a1550754435"],["favicon/mstile-310x150.png","0368a47941d17ec1157bae5e199212cb"],["favicon/mstile-310x310.png","d307e42284c46931eafa51d8f7ca171b"],["favicon/mstile-70x70.png","345e6ef2fe7ce3ceab8dec66477ae757"],["index.html","5960e5f043322d59c65bd6f935510efe"],["js/index.js","156dc22d65a06e70137baa8c24277864"],["js/offline-manager.js","28bd78ca4fcf8ae2b562c51a1cd2f5d3"]];
var CacheNamePrefix = 'sw-precache-v1--' + (self.registration ? self.registration.scope : '') + '-';


var IgnoreUrlParametersMatching = [/^utm_/];



var addDirectoryIndex = function (originalUrl, index) {
    var url = new URL(originalUrl);
    if (url.pathname.slice(-1) === '/') {
      url.pathname += index;
    }
    return url.toString();
  };

var populateCurrentCacheNames = function (precacheConfig, cacheNamePrefix, baseUrl) {
    var absoluteUrlToCacheName = {};
    var currentCacheNamesToAbsoluteUrl = {};

    precacheConfig.forEach(function(cacheOption) {
      var absoluteUrl = new URL(cacheOption[0], baseUrl).toString();
      var cacheName = cacheNamePrefix + absoluteUrl + '-' + cacheOption[1];
      currentCacheNamesToAbsoluteUrl[cacheName] = absoluteUrl;
      absoluteUrlToCacheName[absoluteUrl] = cacheName;
    });

    return {
      absoluteUrlToCacheName: absoluteUrlToCacheName,
      currentCacheNamesToAbsoluteUrl: currentCacheNamesToAbsoluteUrl
    };
  };

var stripIgnoredUrlParameters = function (originalUrl, ignoreUrlParametersMatching) {
    var url = new URL(originalUrl);

    url.search = url.search.slice(1) // Exclude initial '?'
      .split('&') // Split into an array of 'key=value' strings
      .map(function(kv) {
        return kv.split('='); // Split each 'key=value' string into a [key, value] array
      })
      .filter(function(kv) {
        return ignoreUrlParametersMatching.every(function(ignoredRegex) {
          return !ignoredRegex.test(kv[0]); // Return true iff the key doesn't match any of the regexes.
        });
      })
      .map(function(kv) {
        return kv.join('='); // Join each [key, value] array into a 'key=value' string
      })
      .join('&'); // Join the array of 'key=value' strings into a string with '&' in between each

    return url.toString();
  };


var mappings = populateCurrentCacheNames(PrecacheConfig, CacheNamePrefix, self.location);
var AbsoluteUrlToCacheName = mappings.absoluteUrlToCacheName;
var CurrentCacheNamesToAbsoluteUrl = mappings.currentCacheNamesToAbsoluteUrl;

function deleteAllCaches() {
  return caches.keys().then(function(cacheNames) {
    return Promise.all(
      cacheNames.map(function(cacheName) {
        return caches.delete(cacheName);
      })
    );
  });
}

self.addEventListener('install', function(event) {
  var now = Date.now();

  event.waitUntil(
    caches.keys().then(function(allCacheNames) {
      return Promise.all(
        Object.keys(CurrentCacheNamesToAbsoluteUrl).filter(function(cacheName) {
          return allCacheNames.indexOf(cacheName) == -1;
        }).map(function(cacheName) {
          var url = new URL(CurrentCacheNamesToAbsoluteUrl[cacheName]);
          // Put in a cache-busting parameter to ensure we're caching a fresh response.
          if (url.search) {
            url.search += '&';
          }
          url.search += 'sw-precache=' + now;
          var urlWithCacheBusting = url.toString();

          console.log('Adding URL "%s" to cache named "%s"', urlWithCacheBusting, cacheName);
          return caches.open(cacheName).then(function(cache) {
            var request = new Request(urlWithCacheBusting, {credentials: 'same-origin'});
            return fetch(request.clone()).then(function(response) {
              if (response.status == 200) {
                return cache.put(request, response);
              } else {
                console.error('Request for %s returned a response with status %d, so not attempting to cache it.',
                  urlWithCacheBusting, response.status);
                // Get rid of the empty cache if we can't add a successful response to it.
                return caches.delete(cacheName);
              }
            });
          });
        })
      ).then(function() {
        return Promise.all(
          allCacheNames.filter(function(cacheName) {
            return cacheName.indexOf(CacheNamePrefix) == 0 &&
                   !(cacheName in CurrentCacheNamesToAbsoluteUrl);
          }).map(function(cacheName) {
            console.log('Deleting out-of-date cache "%s"', cacheName);
            return caches.delete(cacheName);
          })
        )
      });
    }).then(function() {
      if (typeof self.skipWaiting == 'function') {
        // Force the SW to transition from installing -> active state
        self.skipWaiting();
      }
    })
  );
});

if (self.clients && (typeof self.clients.claim == 'function')) {
  self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
  });
}

self.addEventListener('message', function(event) {
  if (event.data.command == 'delete_all') {
    console.log('About to delete all caches...');
    deleteAllCaches().then(function() {
      console.log('Caches deleted.');
      event.ports[0].postMessage({
        error: null
      });
    }).catch(function(error) {
      console.log('Caches not deleted:', error);
      event.ports[0].postMessage({
        error: error
      });
    });
  }
});


self.addEventListener('fetch', function(event) {
  if (event.request.method == 'GET') {
    var urlWithoutIgnoredParameters = stripIgnoredUrlParameters(event.request.url,
      IgnoreUrlParametersMatching);

    var cacheName = AbsoluteUrlToCacheName[urlWithoutIgnoredParameters];
    var directoryIndex = 'index.html';
    if (!cacheName && directoryIndex) {
      urlWithoutIgnoredParameters = addDirectoryIndex(urlWithoutIgnoredParameters, directoryIndex);
      cacheName = AbsoluteUrlToCacheName[urlWithoutIgnoredParameters];
    }

    if (cacheName) {
      event.respondWith(
        // We can't call cache.match(event.request) since the entry in the cache will contain the
        // cache-busting parameter. Instead, rely on the fact that each cache should only have one
        // entry, and return that.
        caches.open(cacheName).then(function(cache) {
          return cache.keys().then(function(keys) {
            return cache.match(keys[0]).then(function(response) {
              return response || fetch(event.request).catch(function(e) {
                console.error('Fetch for "%s" failed: %O', urlWithoutIgnoredParameters, e);
              });
            });
          });
        }).catch(function(e) {
          console.error('Couldn\'t serve response for "%s" from cache: %O', urlWithoutIgnoredParameters, e);
          return fetch(event.request);
        })
      );
    }
  }
});

