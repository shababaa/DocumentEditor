import dotenv from "dotenv"

// always load server/.env no matter where node is run from

dotenv.config({ path: new URL("../.env", import.meta.url) });

export const config = {
  PORT: Number(process.env.PORT || 5001),
  MYSQL_HOST: process.env.MYSQL_HOST || "127.0.0.1",
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  MYSQL_PORT: Number(process.env.MYSQL_PORT || 3306),

  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",

  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || "sid",
  SESSION_TTL_HOURS: Number(process.env.SESSION_TTL_HOURS || 168),
  COOKIE_SECURE: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS || 12),

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
}
