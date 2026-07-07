import type { Core } from '@strapi/strapi';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // CSP is patched at register time (before the DB is available), so a custom
  // domain saved in the admin settings can't be added there — warn about it.
  const url = await strapi.plugin('kontainer').service('service').getUrl();
  if (!url) return;
  try {
    const host = new URL(url).host;
    const fileUrl = strapi.plugin('kontainer').config('url', '') as string;
    const fileHost = fileUrl ? new URL(fileUrl).host : '';
    const covered =
      host === 'kontainer.com' || host.endsWith('.kontainer.com') || host === fileHost;
    if (!covered) {
      strapi.log.warn(
        `[kontainer] ${host} is not covered by the plugin's Content-Security-Policy patch. ` +
          `Thumbnails may be blocked in the admin. Set KONTAINER_URL (config/plugins) to ${url} or add ${host} to img-src in config/middlewares.`
      );
    }
  } catch {
    // invalid stored URL — the settings endpoint validates, so this is unreachable in practice
  }
};

export default bootstrap;
