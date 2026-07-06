# Kontainer Strapi plugin

Kontainer DAM integration for Strapi 5. Assets stay in Kontainer — Strapi
stores only a JSON reference.

## What it provides

- **`kontainer.media` custom field** — editors pick files from the Kontainer
  file picker (popup, `?cmsMode=1`). The picker's JSON payload is stored
  verbatim on the entry: `fileId`, CDN `url` (incl. `?d=<downloadTemplateId>`
  when a download template is chosen in the picker), `thumbnailUrl`, `alt`,
  `description`, custom fields (`cf`), dimensions, video/focal-point data.
- **File usage endpoint** — `GET /api/kontainer/usage/:fileId` returns every
  entry referencing a Kontainer file id, across drafts, published versions and
  locales. Authenticated with a regular Strapi API token.

## Setup

```ts
// config/plugins.ts
kontainer: {
  enabled: true,
  resolve: './src/plugins/kontainer', // omit when installed from npm
  config: {
    url: env('KONTAINER_URL', ''), // e.g. https://yourcompany.kontainer.com
  },
},
```

Allow Kontainer thumbnails through the admin CSP (`config/middlewares.ts`):

```ts
{
  name: 'strapi::security',
  config: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https://market-assets.strapi.io', 'https://*.kontainer.com'],
        'media-src': ["'self'", 'data:', 'blob:', 'https://*.kontainer.com'],
      },
    },
  },
},
```

Add the field to a content type:

```json
"hero": {
  "type": "customField",
  "customField": "plugin::kontainer.media"
}
```

The stored value is returned as-is by the Strapi content API, so a frontend
reads `entry.hero.url` / `entry.hero.alt` and requests the asset from
Kontainer's CDN directly.

## Usage endpoint

```
GET /api/kontainer/usage/:fileId
Authorization: Bearer <strapi api token>

{ "fileId": "123456", "count": 1, "data": [
  { "contentType": "api::page.page", "field": "hero",
    "documentId": "...", "id": 1, "locale": null, "status": "published" }
] }
```

## Development

Lives as a git submodule in the demo app (`kontainer-cms-strapi`), registered
via `resolve`. `npm run watch` rebuilds on change; the demo app's docker
compose runs it automatically.
