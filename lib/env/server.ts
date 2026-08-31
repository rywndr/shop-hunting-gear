import { z } from "zod"

const nonEmptyString = z.string().trim().min(1)

function readRequiredEnvironmentVariable(name: string): string {
  const result = nonEmptyString.safeParse(process.env[name])

  if (!result.success) {
    throw new Error(`No env ${name}`)
  }

  return result.data
}

function readOptionalEnvironmentVariable(name: string): string | undefined {
  const value = process.env[name]

  if (value === undefined || value.trim() === "") {
    return undefined
  }

  return value.trim()
}

function readGoogleCredentials():
  { clientId: string; clientSecret: string } | undefined {
  const clientId = readOptionalEnvironmentVariable("GOOGLE_CLIENT_ID")
  const clientSecret = readOptionalEnvironmentVariable("GOOGLE_CLIENT_SECRET")

  if (!clientId && !clientSecret) {
    return undefined
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      "No GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    )
  }

  return { clientId, clientSecret }
}

export const serverEnv = {
  get betterAuthSecret() {
    return readRequiredEnvironmentVariable("BETTER_AUTH_SECRET")
  },
  get databaseUrl() {
    return readRequiredEnvironmentVariable("DATABASE_URL")
  },
  get googleCredentials() {
    return readGoogleCredentials()
  },
}
