import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type { Core } from '@strapi/strapi';

const CUSTOM_FIELD = 'plugin::kontainer.media';

// First response's Location header (no redirect following), 5s timeout.
const fetchLocationHeader = (probeUrl: URL): Promise<string | undefined> =>
  new Promise((resolve, reject) => {
    const request = probeUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      probeUrl,
      {
        method: 'GET',
        timeout: 5000,
        // local dev instances use self-signed certificates
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
      (res) => {
        res.destroy();
        resolve(res.headers.location);
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });

export interface UsageEntry {
  contentType: string;
  field: string;
  documentId: string;
  id: number;
  locale: string | null;
  status: 'draft' | 'published';
}

// Shape Kontainer's "external reference" integration expects (one row per
// file-in-a-place). See the plugin README / Kontainer settings docs.
export interface FileUsage {
  kontainerFileId: number;
  url: string;
  title: string;
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
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.fileId !== undefined && String(obj.fileId) === fileId) return true;
    return Object.values(obj).some((v) => referencesFile(v, fileId));
  }
  return false;
};

// Collect every Kontainer file id referenced anywhere in a value. Picker
// payloads always carry `fileId`; entity/component `id`s never do, so this
// won't false-positive. Mirrors referencesFile but gathers all ids.
const collectFileIds = (value: unknown, out: Set<string>): void => {
  if (Array.isArray(value)) {
    value.forEach((v) => collectFileIds(v, out));
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.fileId !== undefined) out.add(String(obj.fileId));
    Object.values(obj).forEach((v) => collectFileIds(v, out));
  }
};

// Best-effort human title for an entry: a string `title`/`name` field, else
// the content type's display name plus id.
const entryTitle = (
  entry: Record<string, unknown>,
  attributes: Attributes,
  displayName: string
): string => {
  for (const field of ['title', 'name']) {
    if (attributes[field]?.type === 'string' && typeof entry[field] === 'string' && entry[field]) {
      return entry[field] as string;
    }
  }
  return `${displayName} #${entry.id}`;
};

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  settingsStore() {
    return strapi.store({ type: 'plugin', name: 'kontainer' });
  },

  // Admin-panel setting wins; config/plugins (env) is the fallback.
  async getUrl(): Promise<string> {
    const stored = (await this.settingsStore().get({ key: 'settings' })) as {
      url?: string;
    } | null;
    const url = stored?.url || (strapi.plugin('kontainer').config('url', '') as string);
    return url.replace(/\/+$/, '');
  },

  async getSettings(): Promise<{ url: string; fileUrl: string; token: string }> {
    const stored = (await this.settingsStore().get({ key: 'settings' })) as {
      url?: string;
      token?: string;
    } | null;
    return {
      url: stored?.url ?? '',
      fileUrl: strapi.plugin('kontainer').config('url', '') as string,
      token: stored?.token ?? '',
    };
  },

  // Bearer token Kontainer must send to the /file/usages endpoint.
  async getUsageToken(): Promise<string> {
    const stored = (await this.settingsStore().get({ key: 'settings' })) as {
      token?: string;
    } | null;
    return stored?.token ?? '';
  },

  // Merge patch into stored settings so saving one field never wipes another.
  async setSettings(patch: { url?: string; token?: string }): Promise<void> {
    const current =
      ((await this.settingsStore().get({ key: 'settings' })) as Record<string, unknown> | null) ??
      {};
    await this.settingsStore().set({ key: 'settings', value: { ...current, ...patch } });
  },

  // Is the URL an actual Kontainer instance? The picker entry point
  // (/?cmsMode=1) redirects to ?cmsContextId=<uuid> — a stable fingerprint
  // that works unauthenticated.
  async validateUrl(raw: string): Promise<{ valid: boolean; reason?: string }> {
    let url: URL;
    try {
      url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('unsupported protocol');
      }
    } catch {
      return { valid: false, reason: 'invalid-url' };
    }
    try {
      const location = await fetchLocationHeader(
        new URL(`${url.protocol}//${url.host}/?cmsMode=1`)
      );
      return location?.includes('cmsContextId=')
        ? { valid: true }
        : { valid: false, reason: 'not-kontainer' };
    } catch {
      return { valid: false, reason: 'unreachable' };
    }
  },

  // Does this component (or any component nested in it) use the custom field?
  componentHasKontainerField(uid: string, seen = new Set<string>()): boolean {
    if (seen.has(uid)) return false;
    seen.add(uid);
    const attributes = (strapi.components[uid]?.attributes ?? {}) as Attributes;
    return Object.values(attributes).some((attr) => {
      if (attr.customField === CUSTOM_FIELD) return true;
      if (attr.type === 'component') {
        return this.componentHasKontainerField(attr.component as string, seen);
      }
      if (attr.type === 'dynamiczone') {
        return (attr.components as string[]).some((c) => this.componentHasKontainerField(c, seen));
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
      if (attr.type === 'component' && this.componentHasKontainerField(attr.component as string)) {
        populate[name] = this.populateForComponent(attr.component as string);
      } else if (attr.type === 'dynamiczone') {
        const withField = (attr.components as string[]).filter((c) =>
          this.componentHasKontainerField(c)
        );
        if (withField.length) {
          populate[name] = {
            on: Object.fromEntries(withField.map((c) => [c, this.populateForComponent(c)])),
          };
        }
      }
    }
    return populate;
  },

  async findUsage(fileId: string): Promise<UsageEntry[]> {
    const usage: UsageEntry[] = [];
    for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
      if (!uid.startsWith('api::')) continue;
      const attributes = contentType.attributes as Attributes;
      const directFields = Object.entries(attributes)
        .filter(([, attr]) => attr.customField === CUSTOM_FIELD)
        .map(([name]) => name);
      const populate = this.populateForAttributes(attributes);
      const candidateFields = [...directFields, ...Object.keys(populate)];
      if (!candidateFields.length) continue;

      for (const status of ['draft', 'published'] as const) {
        // ponytail: full scan of all entries; JSON-contains SQL per dialect
        // if a customer ever has enough entries for this to hurt.
        const pageSize = 500;
        for (let start = 0; ; start += pageSize) {
          const entries = await strapi.documents(uid as any).findMany({
            status,
            populate: populate as any,
            locale: '*',
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

  // All Kontainer file usages across every api content type, in the shape
  // Kontainer's external-reference integration expects. One row per
  // (file, document); url links to the entry in the admin content manager.
  async findAllUsages(baseUrl: string): Promise<FileUsage[]> {
    const base = baseUrl.replace(/\/+$/, '');
    const seen = new Set<string>(); // `${fileId}::${documentId}`
    const usages: FileUsage[] = [];

    for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
      if (!uid.startsWith('api::')) continue;
      const attributes = contentType.attributes as Attributes;
      const directFields = Object.entries(attributes)
        .filter(([, attr]) => attr.customField === CUSTOM_FIELD)
        .map(([name]) => name);
      const populate = this.populateForAttributes(attributes);
      const candidateFields = [...directFields, ...Object.keys(populate)];
      if (!candidateFields.length) continue;

      const displayName = (contentType.info?.displayName as string) ?? uid;

      for (const status of ['draft', 'published'] as const) {
        const pageSize = 500;
        for (let start = 0; ; start += pageSize) {
          const entries = await strapi.documents(uid as any).findMany({
            status,
            populate: populate as any,
            locale: '*',
            start,
            limit: pageSize,
          });
          for (const entry of entries) {
            const ids = new Set<string>();
            for (const field of candidateFields) collectFileIds(entry[field], ids);
            if (!ids.size) continue;

            const url = `${base}/admin/content-manager/collection-types/${uid}/${entry.documentId}`;
            const title = entryTitle(entry as Record<string, unknown>, attributes, displayName);

            for (const fileId of ids) {
              const numericId = Number(fileId);
              if (!Number.isInteger(numericId)) continue; // Kontainer wants int ids
              const key = `${fileId}::${entry.documentId}`;
              if (seen.has(key)) continue;
              seen.add(key);
              usages.push({ kontainerFileId: numericId, url, title });
            }
          }
          if (entries.length < pageSize) break;
        }
      }
    }
    return usages;
  },
});

export default service;
