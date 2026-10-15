# GitHub Actions secrets to provide

Add these in the repository settings → Secrets and variables → Actions.

## Required for deploy

| Name | Where to create |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any domain/Workers overview right sidebar |

Do not paste token values into chat or commit them.

## Turnstile (login bot protection)

Add to repository Actions secrets (already wired in Deploy workflow):

| Name | Purpose |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Widget Siteverify secret (preferred name) |
| `TURNSTILE_SECRET` | Optional alias if you prefer the docs name |

Deploy runs `wrangler secret put TURNSTILE_SECRET` from that value. The public site key lives in `wrangler.jsonc` as `TURNSTILE_SITE_KEY` (not a secret). Production hostnames are `TURNSTILE_HOSTNAMES=hrm.orangecloud.vn`.

Ensure the Turnstile widget domains include `hrm.orangecloud.vn`, and for local login also `localhost` + `127.0.0.1`.

## After first deploy

Update `wrangler.jsonc` vars for:

- `EMAIL_FROM`
- real D1 / KV resource IDs after provisioning
