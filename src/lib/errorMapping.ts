const AUTH_ERROR_RULES: Array<{ includes: string; message: string }> = [
  { includes: 'invalid login credentials', message: 'Неверный email или пароль.' },
  { includes: 'user already registered', message: 'Пользователь с таким email уже зарегистрирован.' },
  { includes: 'password should be at least', message: 'Пароль должен быть не короче 6 символов.' },
  { includes: 'email not confirmed', message: 'Подтвердите email перед входом.' },
]

const TELEGRAM_ERROR_RULES: Array<{ includes: string; message: string }> = [
  {
    includes: 'profiles_telegram_username_unique_idx',
    message: 'Этот Telegram username уже привязан к другому профилю.',
  },
]

function mapByRules(message: string, rules: Array<{ includes: string; message: string }>): string {
  const normalized = message.toLowerCase()
  const matchedRule = rules.find((rule) => normalized.includes(rule.includes))
  return matchedRule?.message ?? message
}

export function mapAuthErrorMessage(message: string): string {
  return mapByRules(message, AUTH_ERROR_RULES)
}

export function mapTelegramErrorMessage(message: string): string {
  return mapByRules(message, TELEGRAM_ERROR_RULES)
}

async function tryParseFunctionErrorBody(error: unknown): Promise<{ error?: string; missingKeys?: string[] } | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return null
  }

  const context = (error as { context?: Response }).context
  if (!(context instanceof Response)) {
    return null
  }

  try {
    return (await context.clone().json()) as { error?: string; missingKeys?: string[] }
  } catch {
    return null
  }
}

export async function mapR2FunctionErrorMessage(error: unknown): Promise<string> {
  const parsedBody = await tryParseFunctionErrorBody(error)
  if (parsedBody?.missingKeys?.length) {
    return `Хранилище не настроено. Добавьте secrets в Supabase: ${parsedBody.missingKeys.join(', ')}`
  }

  if (parsedBody?.error) {
    return parsedBody.error
  }

  if (error instanceof Error && error.message) {
    if (error.message.includes('non-2xx')) {
      return 'Edge Function вернула ошибку. Проверьте R2 secrets в Supabase.'
    }
    return error.message
  }

  return 'Не удалось получить ссылку для загрузки.'
}
