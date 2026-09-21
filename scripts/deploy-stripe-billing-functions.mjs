import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const functions = [
  'stripe-cancel-subscription',
  'stripe-upgrade-subscription',
  'stripe-create-checkout',
]

for (const fn of functions) {
  const build = spawnSync(process.execPath, ['scripts/build-edge-deploy-files.mjs', fn], {
    cwd: root,
    encoding: 'utf8',
  })
  if (build.status !== 0) {
    console.error(build.stderr || build.stdout)
    process.exit(build.status ?? 1)
  }

  const deployArgs = JSON.parse(
    fs.readFileSync(path.join(root, `.edge-deploy-${fn}.json`), 'utf8'),
  )
  fs.writeFileSync(path.join(root, '.mcp-deploy-full.json'), JSON.stringify(deployArgs))

  console.log(`Deploying ${fn}…`)
  const deploy = spawnSync(process.execPath, ['scripts/deploy-via-mcp.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  console.log(deploy.stdout)
  if (deploy.status !== 0) {
    console.error(deploy.stderr || 'Deploy failed')
    console.error(
      'If Unauthorized: deploy from Cursor (Supabase MCP) or run `npx supabase login` then `npx supabase functions deploy …`',
    )
    process.exit(deploy.status ?? 1)
  }
}

console.log('Done.')
