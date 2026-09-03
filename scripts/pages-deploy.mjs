// Used as Cloudflare "Deploy command" for Git builds.
// Cloudflare publishes dist/ automatically — wrangler must NOT run in CI
// (build token lacks Pages API permissions).
console.log('pages:deploy noop — dist/ is published by Cloudflare after build.')
