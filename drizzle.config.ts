import "dotenv/config"
import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("No DATABASE_URL.")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
})
