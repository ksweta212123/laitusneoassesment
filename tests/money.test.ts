import { describe, expect, it } from "vitest";
import { formatMoney, groupIndian, minorUnits, MoneyError, sumMoney, type Money } from "@/lib/money/money";

const inr = (amount: string): Money => ({ amount, currency: "INR", exponent: 2 });

describe("groupIndian", () => {
  it("groups the last three digits, then pairs", () => {
    expect(groupIndian("0")).toBe("0");
    expect(groupIndian("999")).toBe("999");
    expect(groupIndian("1000")).toBe("1,000");
    expect(groupIndian("100000")).toBe("1,00,000");
    expect(groupIndian("12345678")).toBe("1,23,45,678");
    expect(groupIndian("123456789")).toBe("12,34,56,789");
    expect(groupIndian("1234567890123")).toBe("12,34,56,78,90,123");
  });
});

describe("formatMoney", () => {
  it("renders paise exactly", () => {
    expect(formatMoney(inr("0"))).toBe("₹0.00");
    expect(formatMoney(inr("1"))).toBe("₹0.01");
    expect(formatMoney(inr("99"))).toBe("₹0.99");
    expect(formatMoney(inr("100"))).toBe("₹1.00");
    expect(formatMoney(inr("124999"))).toBe("₹1,249.99");
    expect(formatMoney(inr("12345678901"))).toBe("₹12,34,56,789.01");
  });

  it("renders negatives (refunds) with the sign before the symbol", () => {
    expect(formatMoney(inr("-320000"))).toBe("-₹3,200.00");
    expect(formatMoney(inr("-1"))).toBe("-₹0.01");
  });

  it("handles amounts beyond the double-precision integer range without loss", () => {
    // 2^53 + 1 cannot be held in a JS number; as a string through BigInt it is exact.
    expect(formatMoney(inr("9007199254740993"))).toBe("₹9,00,71,99,25,47,409.93");
  });

  it("respects other exponents and labels non-INR currencies with their code", () => {
    expect(formatMoney({ amount: "1234567", currency: "JPY", exponent: 0 })).toBe("JPY 12,34,567");
    expect(formatMoney({ amount: "1234567", currency: "KWD", exponent: 3 })).toBe("KWD 1,234.567");
    expect(formatMoney({ amount: "5", currency: "KWD", exponent: 3 })).toBe("KWD 0.005");
  });

  it("rejects decimals, floats, and non-integer strings", () => {
    expect(() => formatMoney(inr("12.50"))).toThrow(MoneyError);
    expect(() => formatMoney(inr("1e5"))).toThrow(MoneyError);
    expect(() => formatMoney({ amount: 1250 as unknown as string, currency: "INR", exponent: 2 })).toThrow(MoneyError);
    expect(() => formatMoney(inr(""))).toThrow(MoneyError);
  });
});

describe("sumMoney", () => {
  it("adds in BigInt and never mixes currencies", () => {
    expect(sumMoney([inr("1"), inr("2"), inr("-3")], { currency: "INR", exponent: 2 })).toEqual(inr("0"));
    expect(sumMoney([], { currency: "INR", exponent: 2 })).toEqual(inr("0"));
    expect(minorUnits(sumMoney([inr("9007199254740993"), inr("9007199254740993")], { currency: "INR", exponent: 2 }))).toBe(
      18014398509481986n,
    );
    expect(() => sumMoney([{ amount: "1", currency: "USD", exponent: 2 }], { currency: "INR", exponent: 2 })).toThrow(MoneyError);
  });
});
