import express from "express";
import cors from "cors"
import documentsRouter from "./routes/documents.routes.js"
import authRouter from "./routes/auth.routes.js"
import { config } from "./config.js"

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }))
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    })
  )
  
  app.get("/health", (req, res) => {
    res.json({ok: true, message: "server is healthy and running"})
  })

  app.use("/auth", authRouter);
  app.use("/documents", documentsRouter);

  // error handler (must be last)
  app.use((err, req, res, next) => {
    console.error(err)
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ ok: false, error: "Request body is too large" })
    }
    if (err instanceof SyntaxError && err?.status === 400) {
      return res.status(400).json({ ok: false, error: "Request body must be valid JSON" })
    }
    res.status(500).json({ ok: false, error: "Internal server error" })
  })

  return app
}
