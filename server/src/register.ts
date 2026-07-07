import type { Core } from '@strapi/strapi';

// Hosts Kontainer serves assets from; the file-configured tenant URL (if any)
// is appended so custom domains configured via config/plugins also work.
const KONTAINER_CSP_SOURCES = ['https://*.kontainer.com', 'https://kontainer.com'];

const patchContentSecurityPolicy = (strapi: Core.Strapi) => {
  const sources = [...KONTAINER_CSP_SOURCES];
  const fileUrl = strapi.plugin('kontainer').config('url', '') as string;
  if (fileUrl) {
    try {
      const u = new URL(fileUrl);
      sources.push(`${u.protocol}//${u.host}`);
    } catch {
      // invalid URL is reported by the config validator
    }
  }

  const middlewares = strapi.config.get('middlewares') as unknown[];
  const patched = middlewares.map((mw) => {
    const isPlain = mw === 'strapi::security';
    const entry = mw as { name?: string; config?: Record<string, any> };
    if (!isPlain && entry?.name !== 'strapi::security') return mw;

    const config = isPlain ? {} : (entry.config ?? {});
    const csp = config.contentSecurityPolicy ?? {};
    const directives = csp.directives ?? {};
    // helmet defaults that the strapi::security middleware would otherwise apply
    const baseImg = ["'self'", 'data:', 'blob:', 'https://market-assets.strapi.io'];
    const baseMedia = ["'self'", 'data:', 'blob:'];
    const merge = (existing: string[] | undefined, base: string[]) => [
      ...new Set([...(existing ?? base), ...sources]),
    ];

    return {
      name: 'strapi::security',
      config: {
        ...config,
        contentSecurityPolicy: {
          ...csp,
          useDefaults: csp.useDefaults ?? true,
          directives: {
            ...directives,
            'img-src': merge(directives['img-src'], baseImg),
            'media-src': merge(directives['media-src'], baseMedia),
          },
        },
      },
    };
  });
  strapi.config.set('middlewares', patched);
};

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: 'media',
    plugin: 'kontainer',
    type: 'json',
  });

  // allow Kontainer thumbnails in the admin without editing config/middlewares
  patchContentSecurityPolicy(strapi);
};

export default register;
