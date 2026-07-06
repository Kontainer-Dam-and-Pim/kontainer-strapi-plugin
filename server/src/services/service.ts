import type { Core } from "@strapi/strapi";

const CUSTOM_FIELD = "plugin::kontainer.media";

export interface UsageEntry {
  contentType: string;
  field: string;
  documentId: string;
  id: number;
  locale: string | null;
  status: "draft" | "published";
}

type Attributes = Record<string, Record<string, unknown>>;

// True if the value contains a Kontainer picker payload for the given file
// id. Picker payloads always carry `fileId`, so plain entity/component `id`s
// never false-positive. Handles single-file and multi-file payloads and
// payloads nested in populated components/dynamic zones.
const referencesFile = (value: unknown, fileId: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((v) => referencesFile(v, fileId));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.fileId !== undefined && String(obj.fileId) === fileId) return true;
    return Object.values(obj).some((v) => referencesFile(v, fileId));
  }
  return false;
};

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  settingsStore() {
    return strapi.store({ type: "plugin", name: "kontainer" });
  },

  // Admin-panel setting wins; config/plugins (env) is the fallback.
  async getUrl(): Promise<string> {
    const stored = (await this.settingsStore().get({ key: "settings" })) as {
      url?: string;
    } | null;
    const url = stored?.url || (strapi.plugin("kontainer").config("url", "") as string);
    return url.replace(/\/+$/, "");
  },

  async getSettings(): Promise<{ url: string; fileUrl: string }> {
    const stored = (await this.settingsStore().get({ key: "settings" })) as {
      url?: string;
    } | null;
    return {
      url: stored?.url ?? "",
      fileUrl: strapi.plugin("kontainer").config("url", "") as string,
    };
  },

  async setSettings(settings: { url: string }): Promise<void> {
    await this.settingsStore().set({ key: "settings", value: settings });
  },

  // Does this component (or any component nested in it) use the custom field?
  componentHasKontainerField(uid: string, seen = new Set<string>()): boolean {
    if (seen.has(uid)) return false;
    seen.add(uid);
    const attributes = (strapi.components[uid]?.attributes ?? {}) as Attributes;
    return Object.values(attributes).some((attr) => {
      if (attr.customField === CUSTOM_FIELD) return true;
      if (attr.type === "component") {
        return this.componentHasKontainerField(attr.component as string, seen);
      }
      if (attr.type === "dynamiczone") {
        return (attr.components as string[]).some((c) =>
          this.componentHasKontainerField(c, seen),
        );
      }
      return false;
    });
  },

  // Populate spec covering every path to a kontainer field inside a component.
  populateForComponent(uid: string): true | { populate: Record<string, unknown> } {
    const attributes = (strapi.components[uid]?.attributes ?? {}) as Attributes;
    const inner = this.populateForAttributes(attributes);
    return Object.keys(inner).length ? { populate: inner } : true;
  },

  populateForAttributes(attributes: Attributes): Record<string, unknown> {
    const populate: Record<string, unknown> = {};
    for (const [name, attr] of Object.entries(attributes)) {
      if (
        attr.type === "component" &&
        this.componentHasKontainerField(attr.component as string)
      ) {
        populate[name] = this.populateForComponent(attr.component as string);
      } else if (attr.type === "dynamiczone") {
        const withField = (attr.components as string[]).filter((c) =>
          this.componentHasKontainerField(c),
        );
        if (withField.length) {
          populate[name] = {
            on: Object.fromEntries(
              withField.map((c) => [c, this.populateForComponent(c)]),
            ),
          };
        }
      }
    }
    return populate;
  },

  async findUsage(fileId: string): Promise<UsageEntry[]> {
    const usage: UsageEntry[] = [];
    for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
      if (!uid.startsWith("api::")) continue;
      const attributes = contentType.attributes as Attributes;
      const directFields = Object.entries(attributes)
        .filter(([, attr]) => attr.customField === CUSTOM_FIELD)
        .map(([name]) => name);
      const populate = this.populateForAttributes(attributes);
      const candidateFields = [...directFields, ...Object.keys(populate)];
      if (!candidateFields.length) continue;

      for (const status of ["draft", "published"] as const) {
        // ponytail: full scan of all entries; JSON-contains SQL per dialect
        // if a customer ever has enough entries for this to hurt.
        const pageSize = 500;
        for (let start = 0; ; start += pageSize) {
          const entries = await strapi.documents(uid as any).findMany({
            status,
            populate: populate as any,
            locale: "*",
            start,
            limit: pageSize,
          });
          for (const entry of entries) {
            for (const field of candidateFields) {
              if (!referencesFile(entry[field], fileId)) continue;
              usage.push({
                contentType: uid,
                field,
                documentId: entry.documentId,
                id: entry.id as number,
                locale: (entry as { locale?: string }).locale ?? null,
                status,
              });
            }
          }
          if (entries.length < pageSize) break;
        }
      }
    }
    return usage;
  },
});

export default service;
