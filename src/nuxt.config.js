require('./uniform.config').getUniformConfig();
const { config: getUniformNuxtConfig } = require('@uniformdev/nuxt-server');
const WebpackRequireFromPlugin = require('webpack-require-from');
const { consoleLogger } = require('./utils/logging/consoleLogger');
const { resolveServerUrls } = require('./server/util');

const uniformNuxtConfig = getUniformNuxtConfig(consoleLogger);
const nuxtConfig = {
  ...uniformNuxtConfig,
  mode: 'universal',
  /*
   ** Headers of the page
   */
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  },
  /*
   ** Customize the progress-bar color
   */
  loading: false,
  /*
   ** Global CSS
   */
  css: [],
  /*
   ** Plugins to load before mounting the App
   */
  plugins: [
    '~/plugins/sitecore-jss-i18next-plugin',
    '~/plugins/sitecore-jss-placeholder-plugin',
    '~/plugins/sitecore-jss-tracking-api-plugin',
    { src: '~/plugins/export-route-data-context-plugin', mode: 'server' },
  ],
  /*
   ** Nuxt.js dev-modules
   */
  buildModules: [
    // Doc: https://github.com/nuxt-community/eslint-module
    '@nuxtjs/eslint-module',
    // Doc: https://github.com/nuxt-community/nuxt-tailwindcss
    '@nuxtjs/tailwindcss',
  ],
  /*
   ** Nuxt.js modules
   */
  modules: ['@nuxtjs/pwa'],
  /*
   ** Build configuration
   */
  build: {
    /*
     ** You can extend webpack config here
     */
    extend(config, ctx) {
      if (ctx.isDev) {
        config.devtool = ctx.isClient ? 'source-map' : 'inline-source-map';
      }
    },
    plugins: [
      // webpack-require-from plugin allows us to specify where the client-side webpack `publicPath`
      // property value should be read from. For JSS rendering host requests, the actual `publicPath`
      // property we need isn't known until runtime, so we inject the `__nuxt_public_path__` property
      // into the outgoing HTML for the rendering host request. Then we use the webpack-require-from
      // plugin to instruct Webpack to read from the `window.__nuxt_public_path__` variable.
      // This allows requests for async webpack chunks to succeed because they'll use the absolute
      // URL to our Nuxt server instead of a relative path that will resolve to the Sitecore server.
      // NOTE: we use the `suppressErrors` option so that if `__nuxt_public_path__` is undefined on
      // the client, no console errors will be shown. This will happen for requests that are no JSS
      // rendering host requests.
      new WebpackRequireFromPlugin({ variableName: '__nuxt_public_path__', suppressErrors: true }),
    ],
    // Customize the `hotMiddleware` configuration so that requests to the HMR endpoint
    // can succeed in both local development and in JSS rendering host.
    hotMiddleware: {
      // The `//` is intentional due to how Nuxt invokes the hotmiddleware. By default, Nuxt will
      // prepend the client path with `router.base`, which has a default value of `/`. Then the
      // `publicPath` gets prepended to the path, resulting in `{host}/_nuxt//__webpack_hmr/client`.
      path: '/_nuxt//__webpack_hmr/client',
      client: {
        // Set to true to use webpack publicPath as prefix of path.
        dynamicPublicPath: true,
      },
    },
  },
  router: {
    extendRoutes(routes, resolve) {
      const routePatterns = [
        '/:lang([a-z]{2}-[A-Z]{2})/:sitecoreRoute*',
        '/:lang([a-z]{2})/:sitecoreRoute*',
        '/:sitecoreRoute*',
      ];
      // We want our route patterns to be first in the `routes` array, and
      // we want the our route patterns inserted by most "complex" pattern to least "complex".
      routePatterns.reverse().forEach((routePattern) => {
        routes.unshift({
          path: routePattern,
          components: {
            default: resolve(__dirname, 'pages/_.vue'),
          },
        });
      });
      routes.unshift();
    },
  },
  hooks: {
    render: {
      // The `render:resourcesLoaded` hook is called at app startup, when the Vue SSR renderer
      // instance is being created. Using this hook, we're able to modify the default
      // `publicPath` value that is used by the renderer. Unfortunately, this is pretty much
      // the only time we're allowed to modify it at runtime.
      resourcesLoaded(resources) {
        const isStaticExport = process.env.NUXT_EXPORT && process.env.NUXT_EXPORT === 'true';
        // For static export, don't modify the `publicPath`, URLs should be relative because
        // we don't know the URL of the server that the static site will be exported to.
        if (!isStaticExport && resources.clientManifest) {
          // We need to construct a `publicPath` value that contains the current tunnel or server URL and Nuxt path.
          // Use the same URL resolver that is used by `server/index.js` when starting the Nuxt server.
          const { server, tunnel } = resolveServerUrls();
          const publicPath = `${tunnel.url || server.url}/_nuxt/`;
          resources.clientManifest.publicPath = publicPath;
        }
      },
    },
  },
  generate: {
    ...uniformNuxtConfig.generate,
    dir: 'out',
  },
};

module.exports = nuxtConfig;
