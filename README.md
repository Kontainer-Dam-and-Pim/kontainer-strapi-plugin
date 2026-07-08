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
- **File usage tracking** — a `GET /api/kontainer/file/usages` endpoint that
  Kontainer polls to show where each file is used. Register this Strapi instance
  as an integration in Kontainer with the endpoint + a token (set the token
  under **Settings → Kontainer**). Also `GET /api/kontainer/usage/:fileId`
  reports usages for a single file (Strapi API token auth).
- **No duplication** — nothing is uploaded to the Strapi media library.

## Requirements

- Strapi v5 (built and tested on 5.x with the Plugin SDK)
- A Kontainer account (`https://yourcompany.kontainer.com`)

## Installation

```sh
npm install @kontainer/strapi-plugin
# or
yarn add @kontainer/strapi-plugin
```

## Configuration

Open **Settings → Kontainer → Configuration** in the admin panel and enter
your Kontainer URL (e.g. `https://yourcompany.kontainer.com`). That's it — no
code changes required.

The plugin automatically extends the admin panel's Content-Security-Policy so
thumbnails from `*.kontainer.com` (and any URL configured via file config)
load in the editor.

<details>
<summary>Optional: configure via environment instead</summary>

The admin-panel setting wins; this is a fallback for infrastructure-as-code
setups:

```ts
// config/plugins.ts
export default ({ env }) => ({
  kontainer: {
    enabled: true,
    config: {
      url: env('KONTAINER_URL', ''),
    },
  },
});
```

If you use a custom (non-`kontainer.com`) domain configured only through the
admin panel, add it to `img-src`/`media-src` in `config/middlewares.ts` — the
plugin logs a warning at startup when this applies.

</details>

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

### File usage tracking

Kontainer polls one endpoint that returns every Kontainer file usage across all
content types (drafts + published, locales, components and dynamic zones):

```
GET /api/kontainer/file/usages
Authorization: Bearer <token from Settings → Kontainer>

{
  "data": [
    {
      "kontainerFileId": 5764,
      "url": "https://your-strapi/admin/content-manager/collection-types/api::demo-page.demo-page/m3q2h...",
      "title": "Nordic Light"
    }
  ]
}
```

To wire it up: open **Settings → Kontainer**, set (or **Generate**) a token, and
register the shown endpoint URL + token as an integration in Kontainer
(**Settings → Integrations**). No token configured → `403`; missing or wrong
bearer token → `401`.

There is also a per-file variant for programmatic checks (Strapi API token auth):

```
GET /api/kontainer/usage/:fileId
Authorization: Bearer <strapi api token>

{ "fileId": "5764", "count": 1, "data": [ { "contentType": "api::demo-page.demo-page", "field": "hero", "documentId": "m3q2h...", "id": 1, "locale": null, "status": "published" } ] }
```

## Development

```sh
npm install
npm run watch   # rebuild on change
npm run verify  # validate the package before publishing
```

## License

[MIT](./LICENSE) © Kontainer
