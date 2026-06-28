// SMS Billing Configuration & Utilities

export const SMS_PRICING = {
  COST_PER_SMS: 0.30, // TextSMS cost in KES
  SCHOOL_PRICE_PER_SMS: 1.50, // Price we charge schools in KES (margin: 1.20 KES per SMS)
  MIN_BALANCE: 1000, // Minimum balance required to send (KES)
}

export async function deductSmsBalance(schoolId: string, phoneCount: number): Promise<boolean> {
  const cost = phoneCount * SMS_PRICING.SCHOOL_PRICE_PER_SMS
  // This will be called before sending bulk SMS
  // Should check if school has enough balance, then deduct
  // Implementation depends on how you store school credits
  return true
}

export function calculateSmsCost(recipientCount: number): number {
  return recipientCount * SMS_PRICING.SCHOOL_PRICE_PER_SMS
}

export function calculateTextsmsCost(recipientCount: number): number {
  return recipientCount * SMS_PRICING.COST_PER_SMS
}
