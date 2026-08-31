import "dotenv/config"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "../lib/db/client"
import { user } from "../lib/db/schema/auth"

const emailSchema = z.email().transform((email) => email.toLowerCase())

async function grantAdmin() {
  const email = emailSchema.parse(process.argv[2])

  const [adminUser] = await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, email))
    .returning({ id: user.id })

  if (!adminUser) {
    throw new Error(`No user found for ${email}.`)
  }

  console.info(JSON.stringify({ event: "admin.granted", email }))
}

grantAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error."
  console.error(JSON.stringify({ event: "admin.grant_failed", message }))
  process.exitCode = 1
})
