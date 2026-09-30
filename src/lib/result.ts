export type SuccessResult<T> = {
  ok: true
  data: T
}

export type FailureResult = {
  ok: false
  error: string
}

export type Result<T> = SuccessResult<T> | FailureResult

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function toResult<T>(operation: () => Promise<T>, fallbackError: string): Promise<Result<T>> {
  try {
    const data = await operation()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, fallbackError) }
  }
}

export function unwrapResult<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.data
}
