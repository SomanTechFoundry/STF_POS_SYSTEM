import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { localeMiddleware } from "./middleware/locale.js";
import env from "./config/env.js";

const app = express();

function parseCorsOrigins(value) {
  const origins = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    return true;
  }

  return origins;
}

app.use(helmet());
app.use(cors({ origin: parseCorsOrigins(env.CORS_ORIGIN), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(localeMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "enterprise-pos-backend" });
});

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
