import React from 'react'

/**
 * A plain confirmation modal for consequential actions (loan sign-off,
 * disbursal, direct record entry). Replaces the old "2FA" modal, which
 * accepted any 6-character string as a fake one-time code — there's no
 * real OTP/SMS infrastructure behind this app, so pretending otherwise
 * was misleading rather than secure.
 */
export default function ConfirmAction({ show, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {message && <p className="modal-body">{message}</p>}
        <div className="modal-actions mt-1">
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
