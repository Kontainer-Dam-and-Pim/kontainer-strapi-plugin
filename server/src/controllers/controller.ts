import { timingSafeEqual } from 'node:crypto';

import type { Core } from '@strapi/strapi';

// Constant-time compare that tolerates differing lengths.
const secretsMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  // Which entries reference a given Kontainer file id.
  async usage(ctx) {
    const { fileId } = ctx.params;
    if (!fileId) {
      return ctx.badRequest('fileId is required');
    }
    const data = await strapi.plugin('kontainer').service('service').findUsage(String(fileId));
    ctx.body = { fileId: String(fileId), count: data.length, data };
  },

  // Public endpoint Kontainer polls for file usages. Auth is a bearer token
  // stored in plugin settings (Settings -> Kontainer), matching the token
  // configured on the Kontainer integration. Returns { data: [...] }.
  async fileUsages(ctx) {
    const token = await strapi.plugin('kontainer').service('service').getUsageToken();
    if (!token) {
      // Endpoint disabled until a token is set in Settings -> Kontainer.
      return ctx.forbidden('Kontainer usage token is not configured');
    }
    const header = ctx.request.header.authorization ?? '';
    const provided = header.replace(/^Bearer\s+/i, '');
    if (!provided) {
      return ctx.unauthorized('Missing bearer token');
    }
    if (!secretsMatch(provided, token)) {
      return ctx.unauthorized('Invalid token');
    }
    const base = ((strapi.config.get('server.url') as string) || ctx.request.origin || '').trim();
    const data = await strapi.plugin('kontainer').service('service').findAllUsages(base);
    ctx.body = { data };
  },

  // Effective picker URL for the admin input component.
  async config(ctx) {
    ctx.body = { url: await strapi.plugin('kontainer').service('service').getUrl() };
  },

  async getSettings(ctx) {
    ctx.body = await strapi.plugin('kontainer').service('service').getSettings();
  },

  async validateSettings(ctx) {
    const url = String(ctx.query.url ?? '');
    if (!url) {
      return ctx.badRequest('url query parameter is required');
    }
    ctx.body = await strapi.plugin('kontainer').service('service').validateUrl(url);
  },

  async updateSettings(ctx) {
    const { url, token } = (ctx.request.body ?? {}) as { url?: unknown; token?: unknown };
    const patch: { url?: string; token?: string } = {};
    if (url !== undefined) {
      if (typeof url !== 'string' || (url !== '' && !isValidUrl(url))) {
        return ctx.badRequest('url must be empty or a valid http(s) URL');
      }
      patch.url = url.replace(/\/+$/, '');
    }
    if (token !== undefined) {
      if (typeof token !== 'string') {
        return ctx.badRequest('token must be a string');
      }
      patch.token = token.trim();
    }
    await strapi.plugin('kontainer').service('service').setSettings(patch);
    ctx.body = await strapi.plugin('kontainer').service('service').getSettings();
  },
});

export default controller;
