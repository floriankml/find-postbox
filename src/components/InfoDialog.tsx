import { useEffect, useRef } from 'react'
import { setLang, t, useLang } from '../i18n'
import { communityEnabled } from '../lib/community'
import type { ThemePref } from '../hooks/useTheme'
import { AutoThemeIcon, CloseIcon, MoonIcon, SunIcon } from './Icons'
import { MARKER_COLOURS } from './MapView'

export function InfoDialog({ onClose, theme, onCycleTheme }: { onClose: () => void; theme: ThemePref; onCycleTheme: () => void }) {
  const ThemeIcon = theme === 'dark' ? MoonIcon : theme === 'light' ? SunIcon : AutoThemeIcon
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])

  const dot = (c: string) => <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: c }} />

  const lang = useLang()
  const link = (href: string, text: string) => (
    <a className="text-brand-700 underline dark:text-brand-500" href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  )

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        className="pb-safe max-h-[90dvh] w-full overflow-auto rounded-t-3xl bg-white p-5 text-sm leading-relaxed shadow-2xl md:max-w-lg md:rounded-3xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="info-title" className="text-lg font-semibold">
            {t('info.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('close')}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <span id="lang-label" className="font-medium">
            {t('info.language')}
          </span>
          <div role="radiogroup" aria-labelledby="lang-label" className="flex rounded-xl p-1 ring-1 ring-slate-300 dark:ring-slate-700">
            {(
              [
                ['de', 'Deutsch'],
                ['en', 'English'],
              ] as const
            ).map(([code, name]) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={lang === code}
                lang={code}
                onClick={() => setLang(code)}
                className={`h-9 rounded-lg px-3 font-medium ${
                  lang === code ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onCycleTheme}
          className="mt-3 flex h-11 w-full items-center justify-between rounded-xl px-3 ring-1 ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-2">
            <ThemeIcon width={18} height={18} /> {t('info.theme')}
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            {theme === 'dark' ? t('info.themeDark') : theme === 'light' ? t('info.themeLight') : t('info.themeSystem')}
          </span>
        </button>

        <h3 className="mt-4 font-semibold">{t('info.legend')}</h3>
        <ul className="mt-1 space-y-1">
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.international)} {t('ship.long.international')}</li>
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.national)} {t('ship.long.national')}</li>
          <li className="flex items-center gap-2">{dot(MARKER_COLOURS.unknown)} {t('ship.long.unknown')}</li>
          <li className="flex items-center gap-2">{dot('#facc15')} {t('info.legendNearest')}</li>
        </ul>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{t('info.legendNote')}</p>

        <h3 className="mt-4 font-semibold">{t('info.dataTitle')}</h3>
        <p>
          {t('info.dataText1')} {link('https://www.openstreetmap.org/copyright', 'OpenStreetMap')} {t('info.dataText2')}
        </p>
        <p className="mt-2">
          <strong>{t('info.notOfficial')}</strong> {t('info.notOfficialText')}
        </p>

        <h3 className="mt-4 font-semibold">{t('info.intlTitle')}</h3>
        <p>
          {t('info.intlText')}
          {communityEnabled ? ` ${t('info.intlCommunity')}` : ''} {t('info.intlText2')}
        </p>

        <h3 className="mt-4 font-semibold">{t('info.privacyTitle')}</h3>
        <p>{t('info.privacyText')}</p>

        <p className="mt-4 text-slate-600 dark:text-slate-400">
          {t('info.openSource')} {link('https://github.com/floriankml/find-postbox', 'GitHub')}
        </p>
      </div>
    </div>
  )
}
