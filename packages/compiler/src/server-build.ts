export function generateProductionServer(registry: Map<string, string>): string {
  const entries = JSON.stringify(Object.fromEntries(registry), null, 2);

  return `
import { createServer } from "node:http"
import { pathToFileURL, URL } from "node:url"

const registry = ${entries}

async function readBody(req) {
  let raw = ""
  for await (const chunk of req) raw += chunk
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function writeJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")

  if (!url.pathname.startsWith("/__rpc/")) {
    res.writeHead(404)
    res.end()
    return
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "ShadowJS RPC only supports POST." })
    return
  }

  const segments = url.pathname.slice("/__rpc/".length).split("/").filter(Boolean)
  if (segments.length < 2) {
    writeJson(res, 400, { error: "Invalid RPC path." })
    return
  }

  const fnName = segments[segments.length - 1]
  const routePath = segments.slice(0, -1).join("/")
  const modulePath = registry[routePath]

  if (!modulePath) {
    writeJson(res, 404, { error: "No module for route: " + routePath })
    return
  }

  try {
    const mod = await import(pathToFileURL(modulePath).href)
    const fn = mod[fnName]
    if (typeof fn !== "function") {
      writeJson(res, 404, { error: "No handler: " + fnName })
      return
    }
    const args = await readBody(req)
    const result = await fn(...args)
    writeJson(res, 200, result)
  } catch (err) {
    writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
})

const port = process.env.PORT ?? 3000
server.listen(port, () => {
  console.log("ShadowJS RPC server listening on port " + port)
})
`.trim();
}
