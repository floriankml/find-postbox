import { useSyncExternalStore } from 'react'
import { de, type MessageKey } from './de'
import { en } from './en'

export type Lang = 'de' | 'en'
export type { MessageKey }

/** A translatable message stored in data (e.g. a shipping reason), rendered later. */
export interface Msg {
  key: MessageKey
  params?: Record<string, string | number>
}

const DICTS: Record<Lang, Record<MessageKey, string>> = { de, en }
const LOCALES: Record<Lang, string> = { de: 'de-DE', en: 'en-GB' }

function detect(): Lang {
  try {
    const saved = localStorage.getItem('pf-lang')
    if (saved === 'de' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  const langs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []
  // German speakers get German, everybody else English.
  return langs.some((l) => l?.toLowerCase().startsWith('de')) ? 'de' : 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()

function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = current
}
applyDocumentLang()

export function getLang(): Lang {
  return current
}

export function getLocale(): string {
  return LOCALES[current]
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem('pf-lang', lang)
  } catch {
    /* ignore */
  }
  applyDocumentLang()
  listeners.forEach((l) => l())
}

/** Translate a key. `{name}` placeholders are replaced from `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const s = DICTS[current][key] ?? de[key] ?? key
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m))
}

/** Translate a key only if it exists (for open-ended value lists like colours). */
export function tOptional(key: string, params?: Record<string, string | number>): string | null {
  return key in DICTS[current] ? t(key as MessageKey, params) : null
}

export function tm(msg: Msg): string {
  return t(msg.key, msg.params)
}

/** Re-renders the component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}
