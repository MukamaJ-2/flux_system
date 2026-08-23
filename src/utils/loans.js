// A borrower owes the principal plus interest — not just the principal.
// Every "outstanding balance" display in the app should use this instead of
// raw `loan.amount`, otherwise it silently ignores the interest rate the
// group itself configured.
export function totalPayable(loan) {
  const amount = Number(loan.amount) || 0
  const rate = Number(loan.interestRate) || 0
  return amount + (amount * rate) / 100
}

export function outstandingBalance(loan) {
  return Math.max(0, totalPayable(loan) - (Number(loan.repaid) || 0))
}
