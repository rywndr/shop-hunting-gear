const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

export function formatRupiah(value: number) {
  return rupiah.format(value)
}

const signedRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  signDisplay: "always",
})

export function formatSignedRupiah(value: number) {
  return signedRupiah.format(value)
}

const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

export function formatShortDate(value: string) {
  return shortDate.format(new Date(value))
}

const shortTime = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
})

const dateParts = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

function dateKey(value: Date) {
  return dateParts
    .formatToParts(value)
    .filter(({ type }) => type === "day" || type === "month" || type === "year")
    .map(({ value: part }) => part)
    .join("-")
}

export function formatUpdateTime(updatedAt: string, now: string) {
  const updated = new Date(updatedAt)
  const current = new Date(now)
  const minutes = Math.floor(
    (current.getTime() - updated.getTime()) / 60_000
  )

  if (minutes >= 0 && minutes < 60) {
    return `${Math.max(1, minutes)} menit lalu`
  }

  if (dateKey(updated) === dateKey(current)) {
    return `Hari ini ${shortTime.format(updated)}`
  }

  return shortDate.format(updated)
}

const dayMonth = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
})

export function formatDayMonth(value: string) {
  return dayMonth.format(new Date(value))
}

const number = new Intl.NumberFormat("id-ID")

export function formatNumber(value: number) {
  return number.format(value)
}

const compactNumber = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCompactNumber(value: number) {
  return compactNumber.format(value)
}

const rating = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatRating(value: number) {
  return rating.format(value)
}

const signedPercent = new Intl.NumberFormat("id-ID", {
  style: "percent",
  signDisplay: "exceptZero",
  maximumFractionDigits: 1,
})

export function formatSignedPercent(value: number) {
  return signedPercent.format(value)
}
