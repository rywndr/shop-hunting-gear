import { z } from "zod"

const nonEmptyString = z.string().trim().min(1)
const reviewUploadSecretSchema = z.string().trim().min(32)

function readRequiredEnvironmentVariable(name: string): string {
  const result = nonEmptyString.safeParse(process.env[name])

  if (!result.success) {
    throw new Error(`No env ${name}`)
  }

  return result.data
}

function readReviewUploadSecret(): string {
  const result = reviewUploadSecretSchema.safeParse(
    process.env.REVIEW_UPLOAD_SECRET
  )

  if (!result.success) {
    throw new Error("Invalid REVIEW_UPLOAD_SECRET.")
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

function readMidtransConfig():
  | {
      environment: "sandbox" | "production"
      serverKey: string
      clientKey: string
    }
  | undefined {
  const serverKey = readOptionalEnvironmentVariable("MIDTRANS_SERVER_KEY")
  const clientKey = readOptionalEnvironmentVariable("MIDTRANS_CLIENT_KEY")

  if (!serverKey && !clientKey) {
    return undefined
  }

  if (!serverKey || !clientKey) {
    throw new Error("Incomplete Midtrans configuration.")
  }

  const environmentValue = readOptionalEnvironmentVariable(
    "MIDTRANS_ENVIRONMENT"
  )?.toLowerCase()
  const environment = z
    .enum(["sandbox", "production"])
    .safeParse(environmentValue)

  if (!environment.success) {
    throw new Error("Invalid MIDTRANS_ENVIRONMENT.")
  }

  return { environment: environment.data, serverKey, clientKey }
}

function readGoogleCredentials():
  { clientId: string; clientSecret: string } | undefined {
  const clientId = readOptionalEnvironmentVariable("GOOGLE_CLIENT_ID")
  const clientSecret = readOptionalEnvironmentVariable("GOOGLE_CLIENT_SECRET")

  if (!clientId && !clientSecret) {
    return undefined
  }

  if (!clientId || !clientSecret) {
    throw new Error("No GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET")
  }

  return { clientId, clientSecret }
}

function readBackblazeB2Config():
  | {
      keyId: string
      applicationKey: string
      bucket: string
      region: string
    }
  | undefined {
  const values = {
    keyId: readOptionalEnvironmentVariable("B2_KEY_ID"),
    applicationKey: readOptionalEnvironmentVariable("B2_APPLICATION_KEY"),
    bucket: readOptionalEnvironmentVariable("B2_BUCKET"),
    region: readOptionalEnvironmentVariable("B2_REGION"),
  }
  const configured = Object.values(values).filter(Boolean).length

  if (configured === 0) {
    return undefined
  }

  if (configured !== Object.keys(values).length) {
    throw new Error("Incomplete Backblaze B2 configuration.")
  }

  const result = z
    .object({
      keyId: nonEmptyString,
      applicationKey: nonEmptyString,
      bucket: nonEmptyString,
      region: nonEmptyString,
    })
    .safeParse(values)

  if (!result.success) {
    throw new Error("Invalid Backblaze B2 configuration.")
  }

  return result.data
}

export const serverEnv = {
  get betterAuthSecret() {
    return readRequiredEnvironmentVariable("BETTER_AUTH_SECRET")
  },
  get databaseUrl() {
    return readRequiredEnvironmentVariable("DATABASE_URL")
  },
  get reviewUploadSecret() {
    return readReviewUploadSecret()
  },
  get googleCredentials() {
    return readGoogleCredentials()
  },
  get backblazeB2() {
    return readBackblazeB2Config()
  },
  get rajaOngkirApiKey() {
    return readRequiredEnvironmentVariable("RAJAONGKIR_API_KEY")
  },
  get rajaOngkirOriginId() {
    const value = readRequiredEnvironmentVariable("RAJAONGKIR_ORIGIN_ID")
    const result = z.coerce.number().int().positive().safeParse(value)

    if (!result.success) {
      throw new Error("Invalid RAJAONGKIR_ORIGIN_ID.")
    }

    return result.data
  },
  get midtrans() {
    return readMidtransConfig()
  },
}
