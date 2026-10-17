export class Money {
  readonly minor: bigint
  readonly currency: string

  private constructor(minor: bigint, currency: string) {
    this.minor = minor
    this.currency = currency
  }

  static zero(currency = 'INR'): Money {
    return new Money(0n, currency)
  }

  static fromDecimal(value: string, currency = 'INR'): Money {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
    if (!match) throw new Error('Enter an amount with up to two decimal places')
    const fraction = (match[3] ?? '').padEnd(2, '0')
    const minor = BigInt(match[2]) * 100n + BigInt(fraction || '0')
    return new Money(match[1] ? -minor : minor, currency.toUpperCase())
  }

  add(other: Money): Money {
    this.assertCurrency(other)
    return new Money(this.minor + other.minor, this.currency)
  }

  subtract(other: Money): Money {
    this.assertCurrency(other)
    return new Money(this.minor - other.minor, this.currency)
  }

  multiply(quantity: bigint): Money {
    return new Money(this.minor * quantity, this.currency)
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertCurrency(other)
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0
  }

  isNegative(): boolean {
    return this.minor < 0n
  }

  toDecimal(): string {
    const sign = this.minor < 0n ? '-' : ''
    const absolute = this.minor < 0n ? -this.minor : this.minor
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
  }

  format(locale = 'en-IN'): string {
    const amount = Number(this.minor) / 100
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  private assertCurrency(other: Money): void {
    if (this.currency !== other.currency) throw new Error('Currency mismatch')
  }
}
