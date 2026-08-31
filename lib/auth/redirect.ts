const DEFAULT_AUTH_REDIRECT = "/akun"

export function safeAuthRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT
  }

  return value
}
