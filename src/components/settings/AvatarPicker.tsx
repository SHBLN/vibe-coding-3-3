import { useRef, useState, type ChangeEvent } from 'react'
import { UserAvatar } from '../UserAvatar'
import {
  AVATAR_PRESETS,
  isAvatarPresetId,
  saveProfileAvatarPreset,
  saveProfileAvatarUrl,
  type AvatarPresetId,
} from '../../lib/profileAvatar'
import { uploadProfileAvatar } from '../../lib/r2Uploads'

type AvatarPickerProps = {
  displayName: string
  avatarPreset: string | null
  avatarUrl: string | null
  disabled?: boolean
  onUpdated: (next: { avatarPreset: string | null; avatarUrl: string | null }) => void
  onError: (message: string | null) => void
  onSuccess: (message: string | null) => void
}

export function AvatarPicker({
  displayName,
  avatarPreset,
  avatarUrl,
  disabled = false,
  onUpdated,
  onError,
  onSuccess,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const activePreset = avatarUrl ? null : avatarPreset ?? 'preset-1'

  const handleSelectPreset = async (presetId: AvatarPresetId) => {
    if (disabled || saving) return
    onError(null)
    onSuccess(null)
    setSaving(true)
    try {
      await saveProfileAvatarPreset(presetId)
      onUpdated({ avatarPreset: presetId, avatarUrl: null })
      onSuccess('Аватар обновлён.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось сохранить аватар.')
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled || saving) return

    onError(null)
    onSuccess(null)
    setSaving(true)
    try {
      const publicUrl = await uploadProfileAvatar(file)
      await saveProfileAvatarUrl(publicUrl)
      onUpdated({ avatarPreset: null, avatarUrl: publicUrl })
      onSuccess('Своё фото загружено.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось загрузить фото.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <UserAvatar
          displayName={displayName}
          avatarPreset={avatarPreset}
          avatarUrl={avatarUrl}
          className="h-16 w-16 rounded-2xl"
          textClassName="text-lg font-black text-white"
        />
        <div>
          <p className="text-sm font-semibold text-navy">Аватар</p>
          <p className="text-xs text-navy/55">Выберите стиль или загрузите своё фото (до 2 МБ).</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {AVATAR_PRESETS.map((preset) => {
          const selected = !avatarUrl && activePreset === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled || saving}
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={selected}
              onClick={() => void handleSelectPreset(preset.id)}
              className={`rounded-xl p-0.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
                selected ? 'ring-2 ring-accent ring-offset-2' : 'hover:ring-2 hover:ring-navy/15'
              }`}
            >
              <UserAvatar
                displayName={displayName}
                avatarPreset={preset.id}
                avatarUrl={null}
                className="h-12 w-full rounded-lg sm:h-14"
                textClassName="text-[10px] font-black text-white sm:text-xs"
              />
            </button>
          )
        })}
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="sr-only"
          disabled={disabled || saving}
          onChange={(event) => void handleFileChange(event)}
        />
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-navy/10 bg-white px-4 py-2.5 text-sm font-semibold text-navy/70 transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {saving ? 'Сохраняем…' : 'Загрузить своё фото'}
        </button>
      </div>

      {avatarUrl ? (
        <p className="text-xs text-navy/45">Используется загруженное изображение.</p>
      ) : isAvatarPresetId(activePreset ?? '') ? null : (
        <p className="text-xs text-navy/45">По умолчанию — первый стиль с вашими инициалами.</p>
      )}
    </div>
  )
}
