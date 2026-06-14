import express from "express";
import cors from "cors"
import documentsRouter from "./routes/documents.routes.js"
import { config } from "./config.js"

export function createApp() {
  const app = express();

  app.use(express.json())
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    })
  )
  
  app.get("/health", (req, res) => {
    res.json({ok: true, message: "server is healthy and running"})
  })

  app.use("/documents", documentsRouter);

  // error handler (must be last)
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ ok: false, error: "Internal server error" })
  })

  return app
}