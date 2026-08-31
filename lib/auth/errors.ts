type AuthError = {
  code?: string | undefined
  status?: number | undefined
}

export function authErrorMessage(error: AuthError | null): string {
  if (!error) {
    return "Unable to connect. Check your connection and try again."
  }

  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email before signing in."
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Invalid email or password."
    case "INVALID_PASSWORD":
      return "Incorrect password."
    case "USER_ALREADY_EXISTS":
      return "This email is already registered."
    case "USER_NOT_FOUND":
      return "Account not found."
  }

  if (error.status === 429) {
    return "Too many attempts. Wait a moment and try again."
  }

  return "Authentication failed. Try again later."
}
