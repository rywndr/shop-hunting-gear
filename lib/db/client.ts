import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import { serverEnv } from "../env/server"
import { applicationRelations } from "./relations"
import { authRelations } from "./schema/auth-relations"

const sql = neon(serverEnv.databaseUrl)

export const db = drizzle({
  client: sql,
  relations: { ...applicationRelations, ...authRelations },
})
