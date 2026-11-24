import { execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = process.cwd();

// 1. Vite build -> dist/client + dist/server
console.log("Building app...");
execSync("npm run build", { stdio: "inherit" });

const out = resolve(root, ".vercel/output");
rmSync(out, { recursive: true, force: true });

// 2. Static assets
mkdirSync(`${out}/static`, { recursive: true });
cpSync(resolve(root, "dist/client"), `${out}/static`, { recursive: true });

// 3. Bundle server + all deps into a single CJS file
const funcDir = `${out}/functions/__catch__.func`;
mkdirSync(funcDir, { recursive: true });

console.log("Bundling server...");
await build({
  entryPoints: [resolve(root, "dist/server/server.js")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: `${funcDir}/server.cjs`,
  external: ["node:*"],
  // Packages declare sideEffects:false but their bare imports in the server
  // bundle DO matter (h3-v2 event handlers, router registration, etc.)
  ignoreAnnotations: true,
});

// 4. Vercel Node.js function wrapper
writeFileSync(
  `${funcDir}/index.js`,
  `
'use strict'
let handler
try {
  handler = require('./server.cjs').default
} catch (e) {
  console.error('[spectr] Failed to load server bundle:', e)
  handler = null
}

module.exports = async (req, res) => {
  if (!handler) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain')
    res.end('Server failed to initialize. Check function logs.')
    return
  }
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
    const url = new URL(req.url, \`\${proto}://\${host}\`)
    console.log('[spectr] →', req.method, url.toString())

    const chunks = []
    await new Promise((ok, err) => {
      req.on('data', c => chunks.push(c))
      req.on('end', ok)
      req.on('error', err)
    })
    const body = chunks.length ? Buffer.concat(chunks) : undefined

    const webReq = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(
        Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        )
      ),
      ...(body && req.method !== 'GET' && req.method !== 'HEAD'
        ? { body, duplex: 'half' }
        : {}),
    })

    const webRes = await handler.fetch(webReq)
    console.log('[spectr] ←', webRes.status, url.toString())
    if (webRes.status >= 500) {
      const bodyText = await webRes.clone().text()
      console.error('[spectr] 5xx body:', bodyText.slice(0, 1000))
    }
    res.statusCode = webRes.status
    webRes.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await webRes.arrayBuffer()))
  } catch (e) {
    console.error('[spectr] Request handler error:', e)
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain')
    res.end('Internal server error: ' + (e && e.message || String(e)))
  }
}
`,
);

// The wrapper uses require(), so mark the function folder as CommonJS whatever the repo's package.json says.
writeFileSync(`${funcDir}/package.json`, JSON.stringify({ type: "commonjs" }, null, 2));

writeFileSync(
  `${funcDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.js",
      launcherType: "Nodejs",
      supportsResponseStreaming: false,
    },
    null,
    2,
  ),
);

// 5. Routing: static files first, then SSR catch-all
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/__catch__" }],
    },
    null,
    2,
  ),
);

console.log("✅ Vercel output ready at .vercel/output");
