import { execSync } from 'node:child_process'

function isCloudflareCi() {
  if (process.env.CF_PAGES || process.env.CF_PAGES_BRANCH || process.env.CF_PAGES_COMMIT_SHA) {
    return true
  }

  if (process.env.CI === 'true' && process.env.CLOUDFLARE_API_TOKEN) {
    return true
  }

  return process.cwd().includes('buildhome')
}

if (isCloudflareCi()) {
  console.log(
    'Cloudflare CI: dist/ is published automatically after build. Skipping wrangler deploy.',
  )
  process.exit(0)
}

execSync('wrangler pages deploy dist --project-name=vibe-coding-3', {
  stdio: 'inherit',
})
