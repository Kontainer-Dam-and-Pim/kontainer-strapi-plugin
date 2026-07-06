import type { Core } from "@strapi/strapi";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  // Which entries reference a given Kontainer file id.
  async usage(ctx) {
    const { fileId } = ctx.params;
    if (!fileId) {
      return ctx.badRequest("fileId is required");
    }
    const data = await strapi
      .plugin("kontainer")
      .service("service")
      .findUsage(String(fileId));
    ctx.body = { fileId: String(fileId), count: data.length, data };
  },

  // Plugin config for the admin input component (picker URL).
  config(ctx) {
    ctx.body = { url: strapi.plugin("kontainer").config("url", "") };
  },
});

export default controller;
