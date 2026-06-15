/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-286b04b5'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "logoshare.branco.png",
    "revision": "ecd23ddef6fba04dbc53d44884184c00"
  }, {
    "url": "logo.share.png",
    "revision": "7fb257971442b65c481fefd54bfec3d1"
  }, {
    "url": "index.html",
    "revision": "6df9de3193bee6377a929a42c768b92a"
  }, {
    "url": "icon.pilot.png",
    "revision": "3882d90569eb81cd82b469a7d75825fc"
  }, {
    "url": "icon-512.png",
    "revision": "e4320fb562d2e442610b972d8e3057aa"
  }, {
    "url": "favicon.ico",
    "revision": "da7e184e656dad33af6b84cdd8984251"
  }, {
    "url": "assinatura-para-recibo.png",
    "revision": "0ffbb61e6587cdab9cdeecb86c267c7f"
  }, {
    "url": "assets/travelReportFinanceSync-BVfIiuWK.js",
    "revision": null
  }, {
    "url": "assets/purify.es-BSKMTLSQ.js",
    "revision": null
  }, {
    "url": "assets/metarMockData-DdC-KiKs.js",
    "revision": null
  }, {
    "url": "assets/index.es-D4W65QWK.js",
    "revision": null
  }, {
    "url": "assets/index-DI3yL__a.css",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-CBrSDip1.js",
    "revision": null
  }, {
    "url": "assets/NotificationBell-D8igGai0.js",
    "revision": null
  }, {
    "url": "assets/Contatos-g6l7kVj_.js",
    "revision": null
  }, {
    "url": "assets/Clientes-CHY5-lO7.js",
    "revision": null
  }, {
    "url": "assets/CalendarioFerias-JHH983co.js",
    "revision": null
  }, {
    "url": "assets/Aniversarios-gF8A6s0c.js",
    "revision": null
  }, {
    "url": "favicon.ico",
    "revision": "da7e184e656dad33af6b84cdd8984251"
  }, {
    "url": "icon-512.png",
    "revision": "e4320fb562d2e442610b972d8e3057aa"
  }, {
    "url": "logo.share.png",
    "revision": "7fb257971442b65c481fefd54bfec3d1"
  }, {
    "url": "manifest.webmanifest",
    "revision": "5f1b8382d3083fbe7d0fc97422a6d2a1"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/api\.share-brasil\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "api-cache",
    "networkTimeoutSeconds": 10,
    plugins: [new workbox.CacheableResponsePlugin({
      statuses: [200]
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/, new workbox.StaleWhileRevalidate({
    "cacheName": "image-cache",
    plugins: [new workbox.CacheableResponsePlugin({
      statuses: [200]
    })]
  }), 'GET');
  workbox.registerRoute(/\.html$/, new workbox.NetworkFirst({
    "cacheName": "html-cache",
    "networkTimeoutSeconds": 10,
    plugins: []
  }), 'GET');
  workbox.registerRoute(/^https:\/\/.*\.supabase\.co\/.*/i, new workbox.NetworkOnly({
    "cacheName": "supabase-auth",
    plugins: []
  }), 'GET');

}));
