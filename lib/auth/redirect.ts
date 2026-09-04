const DEFAULT_AUTH_REDIRECT = "/account"

export function safeAuthRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT
  }

  return value
}
