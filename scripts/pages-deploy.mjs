import { execSync } from 'node:child_process'

if (process.env.CF_PAGES === '1') {
  console.log(
    'Cloudflare Pages CI: dist/ is published automatically after build. Skipping wrangler deploy.',
  )
  process.exit(0)
}

execSync('wrangler pages deploy dist --project-name=vibe-coding-3', {
  stdio: 'inherit',
})
