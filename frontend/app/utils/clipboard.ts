import { showToast } from '@/app/utils/toast'

/**
 * Копирование текста в буфер обмена.
 * Работает в HTTPS/localhost через navigator.clipboard и имеет fallback для HTTP через execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Современный API (требует secure context: https или localhost)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback ниже
  }

  // Fallback для HTTP/старых браузеров
  try {
    if (typeof document === 'undefined') return false

    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.top = '-9999px'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, el.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export async function copyToClipboardWithToast(text: string, successMessage = 'Ссылка скопирована') {
  const ok = await copyToClipboard(text)
  if (ok) showToast.success(successMessage)
  else showToast.error('Не удалось скопировать. В браузере нужен HTTPS или разрешение на буфер обмена.')
  return ok
}

