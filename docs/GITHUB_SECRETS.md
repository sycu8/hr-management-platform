# GitHub Actions secrets to provide

Add these in the repository settings → Secrets and variables → Actions.

## Required for deploy

| Name | Where to create |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any domain/Workers overview right sidebar |

Do not paste token values into chat or commit them.

## After first deploy

Configure Worker secrets with Wrangler or the dashboard:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Update `wrangler.jsonc` vars for:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `TURNSTILE_SITE_KEY`
- `EMAIL_FROM`
- real D1 / KV resource IDs after provisioning
