/**
 * Helpers for OSM `collection_times` (opening_hours syntax).
 * We intentionally only fully parse the common simple form
 * ("Mo-Fr 17:45; Sa 12:00", "Mo-Sa 09:00,16:00", "PH off"). Anything more
 * complex is shown verbatim instead of being guessed.
 */

import { t, type MessageKey } from '../i18n'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

const day = (d: string) => t(`day.${d}` as MessageKey)
const time = (hhmm: string) => t('time', { time: hhmm })

/** Human readable, translated version of a collection_times value, one entry per rule. */
export function formatCollectionTimes(raw: string): string[] {
  return raw
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((rule) =>
      rule
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b/g, (d) => day(d))
        .replace(/\boff\b|\bclosed\b/gi, t('ct.none'))
        .replace(/-/g, '–')
        .replace(/,(?=\d)/g, ', ')
        .replace(/(\d{2}:\d{2})/g, (m) => time(m)),
    )
}

export type WeekSchedule = string[][] // index 0 = Monday, times "HH:MM"

/** Parse a simple collection_times value. Returns null if not confidently parseable. */
export function parseSimpleCollectionTimes(raw: string): WeekSchedule | null {
  const week: WeekSchedule = [[], [], [], [], [], [], []]
  const rules = raw
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
  if (rules.length === 0) return null
  for (const rule of rules) {
    // Public-holiday rules do not affect the weekly schedule.
    if (/^PH\b/.test(rule)) continue
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*((?:\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2})*|off)$/.exec(
      rule,
    )
    if (!m) return null
    const daySel = m[1] ?? 'Mo-Su'
    const times = m[2] === 'off' ? [] : m[2].split(',').map((x) => x.trim().padStart(5, '0'))
    for (const part of daySel.split(',')) {
      const [a, b] = part.split('-')
      const i0 = DAYS.indexOf(a as (typeof DAYS)[number])
      const i1 = b ? DAYS.indexOf(b as (typeof DAYS)[number]) : i0
      if (i0 < 0 || i1 < 0) return null
      // Support wrap-around ranges like Sa-Mo.
      for (let i = i0; ; i = (i + 1) % 7) {
        week[i] = [...times]
        if (i === i1) break
      }
    }
  }
  return week
}

/** Monday-based weekday index (0 = Monday). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export interface NextCollection {
  /** e.g. "today 17:45", "tomorrow 09:00", "Mon 09:00" */
  label: string
  isToday: boolean
}

/**
 * Next collection after `now`, based on local device time.
 * Note: device time zone may differ from the box's – only shown when the user
 * is plausibly nearby (the caller decides). Public holidays are ignored.
 */
export function nextCollection(raw: string, now: Date = new Date()): NextCollection | null {
  const week = parseSimpleCollectionTimes(raw)
  if (!week) return null
  const today = mondayIndex(now)
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  for (let offset = 0; offset < 8; offset++) {
    const idx = (today + offset) % 7
    const times = [...week[idx]].sort()
    const candidate = offset === 0 ? times.find((x) => x > hhmm) : times[0]
    if (candidate) {
      const dayLabel = offset === 0 ? t('ct.today') : offset === 1 ? t('ct.tomorrow') : day(DAYS[idx])
      return { label: `${dayLabel} ${time(candidate)}`, isToday: offset === 0 }
    }
  }
  return null
}

/** Today's collection times (local device time), or null if unknown. */
export function todaysCollections(raw: string, now: Date = new Date()): string[] | null {
  const week = parseSimpleCollectionTimes(raw)
  if (!week) return null
  return week[mondayIndex(now)]
}
