import type { Core } from "@strapi/strapi";

const CUSTOM_FIELD = "plugin::kontainer.media";

interface UsageEntry {
  contentType: string;
  field: string;
  documentId: string;
  id: number;
  locale: string | null;
  status: "draft" | "published";
}

// True if the stored picker JSON references the given Kontainer file id.
// Walks the value so both single-file and multi-file payloads match.
const referencesFile = (value: unknown, fileId: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((v) => referencesFile(v, fileId));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (String(obj.fileId ?? obj.id ?? "") === fileId) return true;
    return Object.values(obj).some((v) => referencesFile(v, fileId));
  }
  return false;
};

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  // All content-type attributes using the Kontainer custom field.
  kontainerFields(): { uid: string; field: string }[] {
    const fields: { uid: string; field: string }[] = [];
    for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
      if (!uid.startsWith("api::")) continue;
      for (const [name, attr] of Object.entries(contentType.attributes)) {
        if ((attr as { customField?: string }).customField === CUSTOM_FIELD) {
          fields.push({ uid, field: name });
        }
      }
    }
    return fields;
  },

  async findUsage(fileId: string): Promise<UsageEntry[]> {
    const usage: UsageEntry[] = [];
    for (const { uid, field } of this.kontainerFields()) {
      for (const status of ["draft", "published"] as const) {
        // ponytail: full scan of entries with a value; JSON-contains SQL per
        // dialect if a customer ever has enough entries for this to hurt.
        const pageSize = 500;
        for (let start = 0; ; start += pageSize) {
          const entries = await strapi.documents(uid as any).findMany({
            status,
            filters: { [field]: { $notNull: true } },
            fields: [field] as any,
            locale: "*",
            start,
            limit: pageSize,
          });
          for (const entry of entries) {
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
          if (entries.length < pageSize) break;
        }
      }
    }
    return usage;
  },
});

export default service;
