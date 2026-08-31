import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins/admin"

import { MIN_PASSWORD_LENGTH } from "./auth/schema"
import { db } from "./db/client"
import * as authSchema from "./db/schema/auth"
import { serverEnv } from "./env/server"

const googleCredentials = serverEnv.googleCredentials

export const auth = betterAuth({
  secret: serverEnv.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: googleCredentials
    ? {
        google: googleCredentials,
      }
    : {},
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
})

export type AuthSession = typeof auth.$Infer.Session
