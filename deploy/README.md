# Hosting the web app at dailydrip.alexpatten.com

The web app is a static export (`npx expo export --platform web`) served from ap-server-01
the same way as the other sites in `~/apps/websites`:

- **DNS**: a Route 53 A record for `dailydrip.alexpatten.com`.
- **Nginx Proxy Manager** handles HTTPS (Let's Encrypt) and forwards to `http://dailydrip:80`.
- **`dailydrip` container**: `nginx:alpine` in `~/apps/websites/docker-compose.yml` on the
  `proxy` network. It mounts `./dailydrip/source/dist` and `./dailydrip/nginx.conf`.
- **Auto-deploy**: cron runs `~/apps/websites/dailydrip/deploy.sh` every minute. When `main` has
  new commits it pulls them into `./dailydrip/source`, builds, and syncs `dist/` in place. A failed
  build leaves the live site alone. Log: `~/apps/websites/logs/dailydrip-deploy.log`.

The copies of `deploy.sh` and `nginx.conf` here are what's on the server. `deploy.sh` lives
outside the clone so `git reset --hard` can't rewrite it mid-run. Expo SDK 58 needs Node 22+,
newer than the server's Node, so it builds inside a throwaway `node:24-slim` container.

## Deploying

Push to `main`. The site updates within a minute or two. To rebuild without a new commit:

```bash
FORCE=1 ~/apps/websites/dailydrip/deploy.sh
```

If you change `deploy.sh` or `nginx.conf` here, copy them to `~/apps/websites/dailydrip/` (and
run `docker restart dailydrip` after changing `nginx.conf`).

## Supabase redirect

`supabase/config.toml` allows `https://dailydrip.alexpatten.com/**` as an auth redirect, so
verification and password reset emails sent from the web app come back to it. Push it once:

```bash
npx supabase config push
```
