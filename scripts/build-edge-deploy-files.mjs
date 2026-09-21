import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const fnRoot = path.join(root, 'supabase', 'functions')

function read(rel) {
  return fs.readFileSync(path.join(fnRoot, rel), 'utf8')
}

function stripeBundle(entry) {
  return [
    { name: 'index.ts', content: read(`${entry}/index.ts`) },
    { name: '_shared/stripePlans.ts', content: read('_shared/stripePlans.ts') },
    { name: '_shared/subscriptionRules.ts', content: read('_shared/subscriptionRules.ts') },
  ]
}

const presets = {
  'stripe-create-checkout': stripeBundle('stripe-create-checkout'),
  'stripe-cancel-subscription': [
    { name: 'index.ts', content: read('stripe-cancel-subscription/index.ts') },
    { name: '_shared/subscriptionRules.ts', content: read('_shared/subscriptionRules.ts') },
    { name: '_shared/stripePlans.ts', content: read('_shared/stripePlans.ts') },
  ],
  'stripe-upgrade-subscription': stripeBundle('stripe-upgrade-subscription'),
  'stripe-webhook': [
    { name: 'index.ts', content: read('stripe-webhook/index.ts') },
    { name: '_shared/stripePlans.ts', content: read('_shared/stripePlans.ts') },
  ],
  'anymodel-chat': [
    { name: 'index.ts', content: read('anymodel-chat/index.ts') },
    { name: '_shared/planLimits.ts', content: read('_shared/planLimits.ts') },
  ],
  'telegram-ok-reply': [
    { name: 'index.ts', content: read('telegram-ok-reply/index.ts') },
    { name: 'flows.ts', content: read('telegram-ok-reply/flows.ts') },
    { name: 'botCore.ts', content: read('telegram-ok-reply/botCore.ts') },
    { name: 'types.ts', content: read('telegram-ok-reply/types.ts') },
    { name: '_shared/planLimits.ts', content: read('_shared/planLimits.ts') },
  ],
}

const name = process.argv[2]
if (!name || !presets[name]) {
  console.error(
    'Usage: node build-edge-deploy-files.mjs <anymodel-chat|telegram-ok-reply|stripe-create-checkout|stripe-cancel-subscription|stripe-upgrade-subscription|stripe-webhook>',
  )
  process.exit(1)
}

const out = path.join(root, `.edge-deploy-${name}.json`)
fs.writeFileSync(
  out,
  JSON.stringify({
    name,
    entrypoint_path: 'index.ts',
    verify_jwt:
      name === 'anymodel-chat' ||
      name === 'stripe-create-checkout' ||
      name === 'stripe-cancel-subscription' ||
      name === 'stripe-upgrade-subscription',
    files: presets[name],
  }),
)
console.log(out)
