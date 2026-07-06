import type { Core } from "@strapi/strapi";

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: "media",
    plugin: "kontainer",
    type: "json",
  });
};

export default register;
