import type { Core } from '@strapi/strapi';

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
    const { url } = (ctx.request.body ?? {}) as { url?: unknown };
    if (typeof url !== 'string' || (url !== '' && !isValidUrl(url))) {
      return ctx.badRequest('url must be empty or a valid http(s) URL');
    }
    await strapi
      .plugin('kontainer')
      .service('service')
      .setSettings({ url: url.replace(/\/+$/, '') });
    ctx.body = await strapi.plugin('kontainer').service('service').getSettings();
  },
});

export default controller;
