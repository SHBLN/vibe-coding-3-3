import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const payload = {
  name: 'stripe-webhook',
  entrypoint_path: 'index.ts',
  verify_jwt: false,
  files: [
    {
      name: 'index.ts',
      content: fs.readFileSync(
        path.join(root, 'supabase/functions/stripe-webhook/index.ts'),
        'utf8',
      ),
    },
    {
      name: '../_shared/stripePlans.ts',
      content: fs.readFileSync(path.join(root, 'supabase/functions/_shared/stripePlans.ts'), 'utf8'),
    },
  ],
}

fs.writeFileSync(path.join(root, '.mcp-stripe-webhook-deploy.json'), JSON.stringify(payload))
