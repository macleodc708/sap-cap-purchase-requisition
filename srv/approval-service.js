import cds from '@sap/cds'

const { SELECT, UPDATE } = cds.ql

/**
 * Geschäftslogik für Genehmiger (ApprovalService)
 *
 * Freigaberegeln:
 *  - Nur Bestellanforderungen im Status "Zur Freigabe" (S) können entschieden werden.
 *  - Vier-Augen-Prinzip: Niemand darf seine eigene Anforderung freigeben oder ablehnen.
 *  - Ab einem Gesamtwert über `managerApprovalLimit` darf nur die Rolle
 *    "PurchasingManager" (Einkaufsleitung) freigeben.
 */
export default class ApprovalService extends cds.ApplicationService {
  init() {
    const { PurchaseRequisitions } = this.entities
    const db = cds.entities('sap.portfolio.pr')
    const { managerApprovalLimit } = cds.env.requisition

    const decide = async (req, decision) => {
      const { ID } = req.params[0]
      const pr = await SELECT.one.from(db.PurchaseRequisitions, ID)
        .columns('ID', 'status_code', 'totalAmount', 'createdBy')

      if (!pr) return req.reject(404, 'NOT_FOUND')
      if (pr.status_code !== 'S') return req.reject(409, 'DECISION_INVALID_STATUS')
      if (pr.createdBy === req.user.id) return req.reject(403, 'FOUR_EYES')

      if (decision === 'A'
        && Number(pr.totalAmount) > managerApprovalLimit
        && !req.user.is('PurchasingManager')) {
        return req.reject(403, 'MANAGER_APPROVAL_REQUIRED', [managerApprovalLimit])
      }

      let reason = null
      if (decision === 'R') {
        reason = req.data.reason?.trim()
        if (!reason) return req.reject(400, 'REASON_REQUIRED', 'reason')
      }

      // Nur ändern, wenn der Status zwischenzeitlich nicht geändert wurde
      const changed = await UPDATE(db.PurchaseRequisitions)
        .set({
          status_code: decision,
          decidedBy: req.user.id,
          decidedAt: new Date().toISOString(),
          rejectionReason: reason
        })
        .where({ ID, status_code: 'S' })
      if (!changed) return req.reject(409, 'DECISION_INVALID_STATUS')

      req.info(decision === 'A' ? 'APPROVED' : 'REJECTED')
      return SELECT.one.from(PurchaseRequisitions, ID)
    }

    this.on('approveRequisition', PurchaseRequisitions, req => decide(req, 'A'))
    this.on('rejectRequisition', PurchaseRequisitions, req => decide(req, 'R'))

    return super.init()
  }
}
