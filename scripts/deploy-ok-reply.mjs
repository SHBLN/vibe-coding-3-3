import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const deployPath = path.join(root, '.deploy-ok-reply-multi.json')

const payload = JSON.parse(fs.readFileSync(deployPath, 'utf8'))
const args = {
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt,
  files: payload.files,
}

for (const file of args.files) {
  if (/PLACEHOLDER|TRUNCATED/.test(file.content)) {
    throw new Error(`Invalid placeholder content in ${file.name}`)
  }
}

process.stdout.write(JSON.stringify(args))
