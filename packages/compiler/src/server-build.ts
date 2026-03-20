export function generateProductionServer(registry: Map<string, string>): string {
  const entries = JSON.stringify(Object.fromEntries(registry), null, 2);

  return `
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join } from "node:path"
import { pathToFileURL, URL } from "node:url"
import { fileURLToPath } from "node:url"

const registry = ${entries}
const STATIC_DIR = process.env.STATIC_DIR ?? fileURLToPath(new URL("./client", import.meta.url))
const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "application/javascript",
  ".json": "application/json",
  ".mjs": "application/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
}

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

function serveStatic(req, res) {
  const urlPath = new URL(req.url ?? "/", "http://localhost").pathname
  const relativePath = urlPath.replace(/^\\/+/, "")
  let filePath = join(STATIC_DIR, relativePath)

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(STATIC_DIR, "index.html")
  }

  if (!existsSync(filePath)) {
    res.writeHead(404)
    res.end("Not found")
    return
  }

  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream"
  res.writeHead(200, { "Content-Type": contentType })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")

  if (!url.pathname.startsWith("/__rpc/")) {
    serveStatic(req, res)
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
