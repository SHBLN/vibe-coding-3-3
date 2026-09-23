import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const argsPath = path.join(root, '.mcp-deploy-full.json')

const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'))
for (const file of args.files) {
  if (/PLACEHOLDER|TRUNCATED/.test(file.content)) {
    throw new Error(`Invalid placeholder in ${file.name}`)
  }
}

const url = new URL(
  'https://mcp.supabase.com/mcp?project_ref=yxxwpsodzksvxpvizybt&features=docs,account,database,debugging,development,functions,branching',
)
const transport = new StreamableHTTPClientTransport(url)
const client = new Client({ name: 'deploy-ok-reply', version: '1.0.0' })

await client.connect(transport)
const result = await client.callTool({ name: 'deploy_edge_function', arguments: args })
console.log(JSON.stringify(result))
