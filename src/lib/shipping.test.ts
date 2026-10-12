import { describe, expect, it } from 'vitest'
import { detectShipping, operatorRule } from './shipping'

describe('detectShipping', () => {
  it('is unknown without explicit data – colour is ignored', () => {
    for (const colour of ['yellow', 'red', 'blue', 'green']) {
      const s = detectShipping({ amenity: 'post_box', colour, operator: 'Deutsche Post' })
      expect(s.status).toBe('unknown')
      expect(s.evidence).toBe('none')
    }
  })

  it('recognises structured international tags', () => {
    expect(detectShipping({ 'post_box:destination': 'international' }).status).toBe('international')
    expect(detectShipping({ international: 'yes' }).status).toBe('international')
    expect(detectShipping({ destination: 'local;international' }).status).toBe('international')
    expect(detectShipping({ 'post_box:destination': 'international' }).evidence).toBe('osm_tag')
  })

  it('recognises structured domestic-only tags', () => {
    expect(detectShipping({ international: 'no' }).status).toBe('national')
    expect(detectShipping({ 'post_box:destination': 'domestic' }).status).toBe('national')
  })

  it('keeps unrecognised destination values unknown but mentions them', () => {
    const s = detectShipping({ destination: 'Wellington' })
    expect(s.status).toBe('unknown')
    expect(s.hints).toContainEqual({ key: 'ship.hint.unclearTag', params: { tag: 'destination=Wellington' } })
  })

  it('reads free text with weaker evidence', () => {
    const s = detectShipping({ description: 'Auch für Auslandspost' })
    expect(s.status).toBe('international')
    expect(s.evidence).toBe('osm_text')
    expect(detectShipping({ note: 'Not for international mail' }).status).toBe('national')
    expect(detectShipping({ 'description:en': 'Domestic only' }).status).toBe('national')
    expect(detectShipping({ description: 'Neben dem Bäcker' }).status).toBe('unknown')
    expect(detectShipping({ description: 'Vor dem Internationalen Handelszentrum' }).status).toBe('unknown')
    expect(detectShipping({ inscription: 'International mail / Courrier international' }).status).toBe('international')
  })

  it('hints at several apertures without changing the status', () => {
    const s = detectShipping({ 'post_box:apertures': '2' })
    expect(s.status).toBe('unknown')
    expect(s.hints[0]).toEqual({ key: 'ship.hint.apertures', params: { n: 2 } })
  })
})

describe('operatorRule', () => {
  it('matches by wikidata or name', () => {
    expect(operatorRule({ 'operator:wikidata': 'Q157645' })).toBe('rule.deutschePost')
    expect(operatorRule({ operator: 'Royal Mail' })).toBe('rule.royalMail')
    expect(operatorRule({ operator: 'Unknown Post' })).toBeNull()
  })
})
