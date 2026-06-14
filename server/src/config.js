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
}