/**
 * Money is always an integer count of minor units carried as a decimal string,
 * plus the ISO currency code and the exponent (number of minor-unit digits).
 *
 * It is a string, not a number, on purpose: JSON numbers become IEEE doubles in
 * JavaScript, and every function in this module works in BigInt so no value on
 * the money path is ever a float.
 */
export type Money = {
  /** Integer minor units, e.g. "1234567" for ₹12,345.67. May be negative. */
  amount: string;
  /** ISO 4217 code, e.g. "INR". */
  currency: string;
  /** Minor-unit digits, e.g. 2 for INR paise, 0 for JPY, 3 for KWD. */
  exponent: number;
};

const INTEGER_STRING = /^-?\d+$/;

export class MoneyError extends Error {}

/** Parses the amount field into a BigInt, rejecting anything that is not an integer string. */
export function minorUnits(money: Money): bigint {
  if (typeof money.amount !== "string" || !INTEGER_STRING.test(money.amount)) {
    throw new MoneyError(`Money amount must be an integer string, got ${JSON.stringify(money.amount)}`);
  }
  if (!Number.isInteger(money.exponent) || money.exponent < 0 || money.exponent > 6) {
    throw new MoneyError(`Money exponent must be an integer between 0 and 6, got ${money.exponent}`);
  }
  return BigInt(money.amount);
}

export function money(amount: bigint | string, currency: string, exponent: number): Money {
  const m = { amount: amount.toString(), currency, exponent };
  minorUnits(m); // validate
  return m;
}

/** Sums moneys of the same currency and exponent. Mixed currencies are a programming error. */
export function sumMoney(items: readonly Money[], zero: { currency: string; exponent: number }): Money {
  let total = 0n;
  for (const item of items) {
    if (item.currency !== zero.currency || item.exponent !== zero.exponent) {
      throw new MoneyError(`Cannot add ${item.currency}/${item.exponent} to ${zero.currency}/${zero.exponent}`);
    }
    total += minorUnits(item);
  }
  return { amount: total.toString(), currency: zero.currency, exponent: zero.exponent };
}

/**
 * Indian digit grouping: the last three digits form one group, every group
 * before it has two digits. 123456789 -> "12,34,56,789".
 * Implemented by hand rather than via Intl so the output does not depend on
 * which ICU data the runtime shipped with.
 */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(",")},${last3}`;
}

const SYMBOLS: Record<string, string> = { INR: "₹" };

/**
 * Formats for an Indian reader, exact to the last minor unit.
 * ₹ is used for INR; other currencies are prefixed with their ISO code.
 */
export function formatMoney(m: Money): string {
  const units = minorUnits(m);
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const scale = 10n ** BigInt(m.exponent);
  const major = groupIndian((abs / scale).toString());
  const minor = m.exponent > 0 ? `.${(abs % scale).toString().padStart(m.exponent, "0")}` : "";
  const symbol = SYMBOLS[m.currency] ?? `${m.currency} `;
  return `${negative ? "-" : ""}${symbol}${major}${minor}`;
}
