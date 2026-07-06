import { getTranslation } from "./utils/getTranslation";
import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";

import type { StrapiApp } from "@strapi/strapi/admin";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.customFields.register({
      name: "media",
      pluginId: PLUGIN_ID,
      type: "json",
      icon: PluginIcon,
      intlLabel: {
        id: getTranslation("field.label"),
        defaultMessage: "Kontainer media",
      },
      intlDescription: {
        id: getTranslation("field.description"),
        defaultMessage: "Pick a file from Kontainer",
      },
      components: {
        Input: async () => import("./components/KontainerMediaInput"),
      },
      options: {
        advanced: [
          {
            sectionTitle: {
              id: "global.settings",
              defaultMessage: "Settings",
            },
            items: [
              {
                name: "required",
                type: "checkbox",
                intlLabel: {
                  id: getTranslation("field.options.required"),
                  defaultMessage: "Required field",
                },
                description: {
                  id: getTranslation("field.options.required.description"),
                  defaultMessage:
                    "You won't be able to save an entry if this field is empty",
                },
              },
            ],
          },
        ],
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(
            `./translations/${locale}.json`
          )) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};

export default plugin;
