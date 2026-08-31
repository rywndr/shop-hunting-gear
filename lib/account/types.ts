import type { address } from "@/lib/db/schema/account"

export type AccountProvider = "credential" | "google"

export type Account = {
  readonly name: string
  readonly email: string
  readonly provider: AccountProvider
  readonly joinedAt: string
}

type StoredAddress = typeof address.$inferSelect

export type Address = Omit<StoredAddress, "userId" | "createdAt" | "updatedAt">

export function accountProvider(
  providerIds: readonly string[]
): AccountProvider {
  if (providerIds.includes("credential")) {
    return "credential"
  }

  if (providerIds.includes("google")) {
    return "google"
  }

  throw new Error("Account doesn't have supported provider.")
}
