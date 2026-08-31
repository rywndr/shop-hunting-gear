import { randomUUID } from "node:crypto"
import { and, asc, desc, eq } from "drizzle-orm"

import type { AddressValues } from "./schema"
import type { Address } from "./types"
import { db } from "../db/client"
import { address } from "../db/schema/account"

const addressSelection = {
  id: address.id,
  label: address.label,
  recipient: address.recipient,
  phone: address.phone,
  street: address.street,
  province: address.province,
  provinceId: address.provinceId,
  city: address.city,
  cityId: address.cityId,
  district: address.district,
  districtId: address.districtId,
  subdistrict: address.subdistrict,
  subdistrictId: address.subdistrictId,
  postalCode: address.postalCode,
  isPrimary: address.isPrimary,
}

export function addressesForUser(userId: string): Promise<readonly Address[]> {
  return db
    .select(addressSelection)
    .from(address)
    .where(eq(address.userId, userId))
    .orderBy(desc(address.isPrimary), asc(address.createdAt))
}

async function clearPrimaryAddress(userId: string) {
  await db
    .update(address)
    .set({ isPrimary: false })
    .where(and(eq(address.userId, userId), eq(address.isPrimary, true)))
}

export async function createAddressForUser({
  userId,
  values,
}: {
  userId: string
  values: AddressValues
}) {
  const [existing] = await db
    .select({ id: address.id })
    .from(address)
    .where(eq(address.userId, userId))
    .limit(1)
  const isPrimary = values.isPrimary || !existing

  if (isPrimary) {
    await clearPrimaryAddress(userId)
  }

  await db.insert(address).values({
    id: randomUUID(),
    userId,
    ...values,
    isPrimary,
  })
}

export async function updateAddressForUser({
  userId,
  id,
  values,
}: {
  userId: string
  id: string
  values: AddressValues
}) {
  const [existing] = await db
    .select({ isPrimary: address.isPrimary })
    .from(address)
    .where(and(eq(address.id, id), eq(address.userId, userId)))
    .limit(1)

  if (!existing) {
    return false
  }

  const isPrimary = existing.isPrimary || values.isPrimary

  if (values.isPrimary && !existing.isPrimary) {
    await clearPrimaryAddress(userId)
  }

  await db
    .update(address)
    .set({ ...values, isPrimary })
    .where(and(eq(address.id, id), eq(address.userId, userId)))

  return true
}

export async function setPrimaryAddressForUser({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  const [owned] = await db
    .select({ id: address.id })
    .from(address)
    .where(and(eq(address.id, id), eq(address.userId, userId)))
    .limit(1)

  if (!owned) {
    return false
  }

  await clearPrimaryAddress(userId)
  await db
    .update(address)
    .set({ isPrimary: true })
    .where(and(eq(address.id, id), eq(address.userId, userId)))

  return true
}

export async function deleteAddressForUser({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  const [owned] = await db
    .select({ isPrimary: address.isPrimary })
    .from(address)
    .where(and(eq(address.id, id), eq(address.userId, userId)))
    .limit(1)

  if (!owned) {
    return false
  }

  await db
    .delete(address)
    .where(and(eq(address.id, id), eq(address.userId, userId)))

  if (owned.isPrimary) {
    const [replacement] = await db
      .select({ id: address.id })
      .from(address)
      .where(eq(address.userId, userId))
      .orderBy(asc(address.createdAt))
      .limit(1)

    if (replacement) {
      await db
        .update(address)
        .set({ isPrimary: true })
        .where(eq(address.id, replacement.id))
    }
  }

  return true
}
