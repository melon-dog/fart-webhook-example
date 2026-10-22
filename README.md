# Fart webhook example

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/melon-dog/fart-webhook-example)
[![Tests](https://github.com/melon-dog/fart-webhook-example/actions/workflows/test.yml/badge.svg)](https://github.com/melon-dog/fart-webhook-example/actions/workflows/test.yml)

Minimal Cloudflare Worker that receives [Fart Noises](https://fart.jtez.xyz/developers)
webhooks, verifies the HMAC signature and logs the payload.

## What it does

- `POST /webhook` (also `POST /`): receives a Fart notification.
  - `X-Fart-Test: 1` → **204** (unsigned connection check used when adding the
    endpoint in Fart; the secret does not exist yet).
  - Otherwise verifies `X-Fart-Signature` / `X-Fart-Timestamp`
    (`HMAC-SHA256(secret, "<timestamp>.<rawBody>")`).
  - Valid → logs the payload and returns **204**.
  - Invalid signature or stale timestamp → **401**.
  - Invalid JSON → **400**.
  - Missing `FART_WEBHOOK_SECRET` → **503**.
- `GET /health`: JSON status (`ok`, `secretConfigured`).

No custom frontend is needed: the webhook is configured in the Fart web app
(**Settings → Developers**). This Worker only receives notifications.

## Requirements

- A Cloudflare account.
- For the one-click deploy: a public GitHub or GitLab repository.
- For the CLI: Node.js 24+, npm and `npx wrangler login`.

## Deploy

### One-click (Deploy to Cloudflare)

Use the button at the top of this README. Cloudflare will:

1. Clone this repository into your GitHub/GitLab account.
2. Ask for the repository and Worker names.
3. Build and deploy with Workers Builds.
4. Provision the Worker and show its URL.

The setup page reads `.dev.vars.example` and the `cloudflare.bindings`
description in `package.json`. You do not have the real `FART_WEBHOOK_SECRET`
yet: use a placeholder such as `whsec_replace_me` (or leave it empty) and update
it after Fart creates the webhook. The unsigned connection check works without
the real secret.

After the Worker is deployed, continue with **Configure it in Fart** below.

### CLI

```bash
npm install
npx wrangler login
npm run deploy
npx wrangler secret put FART_WEBHOOK_SECRET
```

Wrangler prints the Worker URL, for example:

```
https://fart-webhook-example.<your-subdomain>.workers.dev
```

### Git integration (Workers Builds)

Fork this repository, then in the Cloudflare dashboard go to
**Workers & Pages → Create → Connect to Git**, select the fork, use
`npm install` as the build command and `npx wrangler deploy` as the deploy
command, and add `FART_WEBHOOK_SECRET` in the Worker settings. Pushes to the
connected branch redeploy the Worker.

## Configure it in Fart

The Fart web app is the configuration UI; you do not need to build a frontend
for this Worker.

1. Open **Fart Noises → Settings → Developers**.
2. Add `https://fart-webhook-example.<your-subdomain>.workers.dev/webhook`.
3. Fart sends an **unsigned** connection check (`X-Fart-Test: 1`). This Worker
   answers 204, so Fart creates the webhook and shows the `whsec_...` secret.
4. Copy that secret and store it in the Worker:
   ```bash
   npx wrangler secret put FART_WEBHOOK_SECRET
   ```
   Or use Cloudflare dashboard → your Worker → **Settings → Variables and
   Secrets**.
5. Press **Test** in Fart. The signed request must pass verification.
6. Send a real notification and watch the payload:
   ```bash
   npm run tail
   ```

> The first connection check is intentionally unsigned because Fart generates
> the secret together with the webhook. Do not reject `X-Fart-Test: 1` or the
> endpoint cannot be added.

`GET /health` reports `secretConfigured: true` once the real secret is set.

### Configuration API (optional)

The Fart backend exposes the same actions the Developers tab uses:

- `GET /-/webhooks`
- `POST /-/webhooks` with `{ action: "create" | "update" | "delete" | "test" | "rotate", ... }`

It is authenticated with the Fart session JWT (the token the web app uses).
There are no public API keys; a third-party panel that wants to configure
webhooks without a Fart session would need a separate API-key feature.

## Local development

```bash
cp .dev.vars.example .dev.vars
# edit FART_WEBHOOK_SECRET
npm run dev
```

`wrangler dev` listens on `http://localhost:8787`. Fart cannot reach localhost;
use a tunnel (for example Cloudflare Tunnel) or deploy the Worker for the real
integration test.

> If npm blocks install scripts, approve the local binaries before running
> `wrangler dev`: `npm install-scripts approve workerd esbuild`.

## Tests

```bash
npm test
npm run typecheck
```

The tests cover valid/invalid HMAC signatures and the timestamp window.

GitHub Actions runs `npm run typecheck` and `npm test` on every push and pull
request (`.github/workflows/test.yml`).

## Notes

- The Deploy to Cloudflare button requires a public GitHub/GitLab repository and
  only supports Workers applications.
- The button clones the repository into your GitHub/GitLab account, so you can
  keep editing it after deploying.
- The secret is only stored as a Worker secret; `.dev.vars` is gitignored.
- The Worker never echoes the secret.
- The response body is irrelevant to Fart: only the status code matters.
- Full payload/signature documentation:
  https://fart.jtez.xyz/developers
