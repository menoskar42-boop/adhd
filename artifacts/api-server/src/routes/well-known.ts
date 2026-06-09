import { Router, type IRouter } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const router: IRouter = Router();

// Load the OpenAPI spec once at startup. build.mjs copies openapi.yaml
// next to the bundle, so we resolve relative to import.meta.url and
// keep the source of truth in lib/api-spec.
const specPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "openapi.yaml",
);

let openapiYaml = "";
try {
  openapiYaml = readFileSync(specPath, "utf8");
} catch {
  // If the file is missing in some packaging path, we still want the
  // rest of the server up — the api-catalog will just point at a 404.
}

// Raw spec for agents (and humans) that want the contract directly.
router.get("/openapi.yaml", (_req, res) => {
  if (!openapiYaml) {
    res.status(404).send("openapi spec not available");
    return;
  }
  res.type("application/yaml").send(openapiYaml);
});

// RFC 9727 linkset: tells agents where to find the spec, the docs, and
// the health endpoint for this API.
router.get("/.well-known/api-catalog", (req, res) => {
  // Build absolute URLs from the request so the catalog works behind
  // any proxy or origin without hard-coding a base URL.
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const base = `${proto}://${host}`;

  const linkset = {
    linkset: [
      {
        anchor: `${base}/api`,
        "service-desc": [
          { href: `${base}/openapi.yaml`, type: "application/yaml" },
        ],
        status: [{ href: `${base}/api/healthz` }],
      },
    ],
  };

  res.type("application/linkset+json").json(linkset);
});

export default router;
