type MidtransSnapCallbacks = {
  readonly onSuccess?: (result: unknown) => void
  readonly onPending?: (result: unknown) => void
  readonly onError?: (result: unknown) => void
  readonly onClose?: () => void
}

type MidtransSnap = {
  pay(token: string, callbacks?: MidtransSnapCallbacks): void
  hide(): void
}

interface Window {
  snap?: MidtransSnap
}
