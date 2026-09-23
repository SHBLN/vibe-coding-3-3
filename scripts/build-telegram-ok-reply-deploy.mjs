import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const fnDir = path.join(root, 'supabase/functions/telegram-ok-reply')

const files = ['index.ts', 'types.ts', 'botCore.ts', 'flows.ts'].map((name) => ({
  name,
  content: fs.readFileSync(path.join(fnDir, name), 'utf8'),
}))

const payload = {
  name: 'telegram-ok-reply',
  entrypoint_path: 'index.ts',
  verify_jwt: false,
  files,
}

fs.writeFileSync(path.join(root, '.deploy-ok-reply-multi.json'), JSON.stringify(payload))
console.log(
  JSON.stringify({
    files: files.map((f) => ({ name: f.name, bytes: Buffer.byteLength(f.content) })),
    total: Buffer.byteLength(JSON.stringify(payload)),
  }),
)
