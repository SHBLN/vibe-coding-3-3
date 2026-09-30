type SettingsAlertProps = {
  error: string | null
  success: string | null
}

export function SettingsAlert({ error, success }: SettingsAlertProps) {
  return (
    <>
      {error ? (
        <div
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {success}
        </div>
      ) : null}
    </>
  )
}
