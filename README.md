# Strapi plugin: Kontainer DAM

[Kontainer](https://kontainer.com) integration for **Strapi 5**. Content
editors pick images, videos and files straight from your Kontainer DAM inside
the Strapi editor — Strapi stores only a JSON reference to the asset, never
the file. Kontainer stays the single source of truth.

## Features

- **`kontainer.media` custom field** — a "Choose from Kontainer" button on any
  content type opens the Kontainer file picker. Selecting a file stores its
  reference on the entry:
  - `fileId`, `fileName`, `folderId` — identifiers for retrieving the asset
  - `url` — CDN URL, including the chosen **download template**
    (`?d=<templateId>`), plus `urlBaseName` and `originalUrl`
  - `thumbnailUrl`, `type`, `extension`, dimensions and size
  - **all texts**: `alt`, `description` and every Kontainer custom field
    (`cf`) — stored in the JSON alongside the reference
- **Download templates** — editors apply crop/resize/format templates directly
  in the picker; the resulting CDN URL and template id are stored.
- **File usage endpoint** — `GET /api/kontainer/usage/:fileId` reports every
  entry referencing a Kontainer file, across drafts, published versions,
  locales, components and dynamic zones. Lets Kontainer show where a file is
  used before it is changed or deleted.
- **No duplication** — nothing is uploaded to the Strapi media library.

## Requirements

- Strapi v5 (built and tested on 5.x with the Plugin SDK)
- A Kontainer account (`https://yourcompany.kontainer.com`)

## Installation

```sh
npm install strapi-plugin-kontainer
# or
yarn add strapi-plugin-kontainer
```

## Configuration

```ts
// config/plugins.ts
export default ({ env }) => ({
  kontainer: {
    enabled: true,
    config: {
      url: env('KONTAINER_URL', ''), // e.g. https://yourcompany.kontainer.com
    },
  },
});
```

Allow Kontainer thumbnails through the admin panel's CSP:

```ts
// config/middlewares.ts
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

## Usage

### Add the field to a content type

In the Content-Type Builder choose **Custom fields → Kontainer media**, or add
it to the schema directly:

```json
"hero": {
  "type": "customField",
  "customField": "plugin::kontainer.media"
}
```

### Consume from your frontend

The stored reference is returned as-is by the Strapi content API:

```ts
const page = await fetch(`${STRAPI_URL}/api/pages/${documentId}`).then((r) => r.json());
const { url, alt } = page.data.hero; // request the asset from Kontainer's CDN
```

### File usage

```
GET /api/kontainer/usage/:fileId
Authorization: Bearer <strapi api token>

{
  "fileId": "5764",
  "count": 1,
  "data": [
    {
      "contentType": "api::page.page",
      "field": "hero",
      "documentId": "m3q2h...",
      "id": 1,
      "locale": null,
      "status": "published"
    }
  ]
}
```

## Development

```sh
npm install
npm run watch   # rebuild on change
npm run verify  # validate the package before publishing
```

## License

[MIT](./LICENSE) © Kontainer
