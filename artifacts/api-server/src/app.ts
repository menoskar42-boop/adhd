import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import wellKnownRouter from "./routes/well-known";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Advertise the API catalog on every response so AI agents discovering
// the origin pick it up without needing to guess well-known paths
// (RFC 8288). The catalog itself lives at /.well-known/api-catalog.
app.use((_req, res, next) => {
  res.append(
    "Link",
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  );
  res.append(
    "Link",
    '</openapi.yaml>; rel="service-desc"; type="application/yaml"',
  );
  next();
});

// Well-known and the raw spec sit at the origin root, not under /api.
app.use(wellKnownRouter);

app.use("/api", router);

export default app;
