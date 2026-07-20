# Sync2Dine marketing (httpdocs) vs app

- **Public sales:** WordPress at `/var/www/vhosts/sync2dine.io/httpdocs` → https://sync2dine.io/
- **App (login / product):** `/var/www/vhosts/sync2dine.io/app.sync2dine.io` → https://app.sync2dine.io/
- SPA deploy (`scripts/deploy-spa.sh`) must **never** target `httpdocs`.
- Theme overrides: `wp-content/themes/hello-elementor-child/sync2dine-dual-product.php` (Sally top bar, Atmosphere prices, legal footer, brand icon).
- Source of package prices: `server/saas-packages.ts` / fare `s2d-fare-2026-07-19`.
- After theme edits: purge LiteSpeed (`wp litespeed-purge` / purge all) so Sally script is not delayed.
