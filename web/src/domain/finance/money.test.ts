import { describe, expect, it } from 'vitest'
import { Money } from './money'

describe('Money', () => {
  it('adds and subtracts decimal amounts without floating point drift', () => {
    const total = Money.fromDecimal('0.10').add(Money.fromDecimal('0.20')).subtract(Money.fromDecimal('0.05'))
    expect(total.toDecimal()).toBe('0.25')
  })

  it('rejects invalid precision and mixed currencies', () => {
    expect(() => Money.fromDecimal('1.001')).toThrow(/two decimal places/)
    expect(() => Money.fromDecimal('2.00', 'USD').add(Money.fromDecimal('1.00', 'INR'))).toThrow(/Currency mismatch/)
  })

  it('preserves sign and comparison order', () => {
    const amount = Money.fromDecimal('-12.35')
    expect(amount.isNegative()).toBe(true)
    expect(amount.toDecimal()).toBe('-12.35')
    expect(amount.compare(Money.zero())).toBe(-1)
  })
})
