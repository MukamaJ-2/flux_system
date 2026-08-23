// Shared CSV export for contribution records — used by Treasury (group
// statements), Audit (audit report), and Profile (personal statement).
export function downloadRecordsCsv(records, filename) {
  const headers = ['Date', 'Member', 'Amount', 'Method', 'Note']
  const rows = (records || []).map((r) => [
    new Date(r.date).toLocaleDateString(),
    r.memberName,
    r.amount,
    r.method,
    r.note || '',
  ])
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
