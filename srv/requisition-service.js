import cds from '@sap/cds'
import { today, round2 } from './lib/utils.js'

const { SELECT, UPDATE } = cds.ql

/**
 * Geschäftslogik für Anforderer (RequisitionService)
 */
export default class RequisitionService extends cds.ApplicationService {
  init() {
    const { PurchaseRequisitions, Items, Materials } = this.entities
    const db = cds.entities('sap.portfolio.pr')
    const { autoApprovalLimit } = cds.env.requisition

    // ----------------------------------------------------------------
    // Entwurf anlegen: Standardwerte setzen
    // ----------------------------------------------------------------
    this.before('NEW', PurchaseRequisitions.drafts, req => {
      req.data.status_code = 'N'
      req.data.priority_code ??= 'M'
      req.data.currency_code ??= 'EUR'
      req.data.totalAmount = 0
    })

    // Positionen werden SAP-typisch in 10er-Schritten nummeriert (10, 20, 30 ...)
    this.before('NEW', Items.drafts, async req => {
      const { max } = await SELECT.one
        .from(Items.drafts)
        .columns('max(itemNo) as max')
        .where({ parent_ID: req.data.parent_ID })
      req.data.itemNo = (max ?? 0) + 10
    })

    // Material gewählt -> Bezeichnung, Einheit und Preis aus dem Materialstamm übernehmen
    this.before(['NEW', 'PATCH'], Items.drafts, async req => {
      if (!req.data.material_ID) return
      const material = await SELECT.one.from(Materials, req.data.material_ID)
      if (material) {
        Object.assign(req.data, {
          description: material.name,
          unit: material.unit,
          unitPrice: material.price
        })
      }
    })

    // Gesamtwert im Entwurf aktuell halten, wenn Positionen geändert werden
    const recalcDraftTotal = async parent_ID => {
      if (!parent_ID) return
      const { total } = await SELECT.one
        .from(Items.drafts)
        .columns('sum(quantity * unitPrice) as total')
        .where({ parent_ID })
      await UPDATE(PurchaseRequisitions.drafts)
        .set({ totalAmount: round2(total ?? 0) })
        .where({ ID: parent_ID })
    }
    const parentOfDraftItem = async ID =>
      (await SELECT.one.from(Items.drafts).columns('parent_ID').where({ ID }))?.parent_ID

    this.after(['NEW', 'PATCH'], Items.drafts, async (_, req) => {
      await recalcDraftTotal(req.data.parent_ID ?? (await parentOfDraftItem(req.data.ID)))
    })
    this.before('CANCEL', Items.drafts, async req => {
      req._parentID = await parentOfDraftItem(req.data.ID)
    })
    this.after('CANCEL', Items.drafts, async (_, req) => {
      await recalcDraftTotal(req._parentID)
    })

    // ----------------------------------------------------------------
    // Bearbeiten / Löschen nur in erlaubten Status
    // ----------------------------------------------------------------
    const statusOf = async req => {
      const ID = req.params.at(-1)?.ID ?? req.data.ID
      if (!ID) return
      return (await SELECT.one.from(db.PurchaseRequisitions, ID).columns('status_code'))?.status_code
    }

    this.before('EDIT', PurchaseRequisitions, async req => {
      const status = await statusOf(req)
      if (status && !['N', 'R'].includes(status)) req.reject(409, 'EDIT_NOT_ALLOWED')
    })

    this.before('DELETE', PurchaseRequisitions, async req => {
      const status = await statusOf(req)
      if (status && status !== 'N') req.reject(409, 'DELETE_NOT_ALLOWED')
    })

    // ----------------------------------------------------------------
    // Prüfungen beim Speichern (Aktivieren) des Entwurfs
    // ----------------------------------------------------------------
    this.before('SAVE', PurchaseRequisitions, req => {
      const { neededBy, items = [] } = req.data
      if (neededBy && neededBy < today()) {
        req.error({ status: 400, message: 'NEEDED_BY_IN_PAST', target: 'in/neededBy' })
      }
      for (const item of items) {
        const path = `in/items(ID=${item.ID},IsActiveEntity=false)`
        if (item.quantity != null && Number(item.quantity) <= 0) {
          req.error({ status: 400, message: 'QUANTITY_NOT_POSITIVE', target: `${path}/quantity` })
        }
        if (item.unitPrice != null && Number(item.unitPrice) < 0) {
          req.error({ status: 400, message: 'PRICE_NEGATIVE', target: `${path}/unitPrice` })
        }
      }
    })

    // Beim Aktivieren: Gesamtwert berechnen und BANF-Nummer vergeben
    this.before(['CREATE', 'UPDATE'], PurchaseRequisitions, req => {
      if (!req.data.items) return
      const total = req.data.items.reduce(
        (sum, i) => sum + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0)
      req.data.totalAmount = round2(total)
    })

    this.before('CREATE', PurchaseRequisitions, async req => {
      const { max } = await SELECT.one
        .from(db.PurchaseRequisitions)
        .columns('max(requisitionNo) as max')
      req.data.requisitionNo = String(Number(max ?? 10000000) + 1)
    })

    // ----------------------------------------------------------------
    // Aktionen
    // ----------------------------------------------------------------
    const loadOwn = async req => {
      const { ID } = req.params[0]
      const pr = await SELECT.one.from(db.PurchaseRequisitions, ID)
        .columns(r => { r.ID, r.status_code, r.totalAmount, r.createdBy, r.items(i => { i.ID }) })
      if (!pr) return req.reject(404, 'NOT_FOUND')
      if (pr.createdBy !== req.user.id) return req.reject(403, 'NOT_OWNER')
      return pr
    }
    const readActive = ID => this.run(SELECT.one.from(PurchaseRequisitions, { ID, IsActiveEntity: true }))

    this.on('submit', PurchaseRequisitions, async req => {
      const pr = await loadOwn(req)
      if (!['N', 'R'].includes(pr.status_code)) return req.reject(409, 'SUBMIT_INVALID_STATUS')
      if (!pr.items.length) return req.reject(400, 'SUBMIT_NO_ITEMS')

      const autoApprove = Number(pr.totalAmount) <= autoApprovalLimit
      await UPDATE(db.PurchaseRequisitions, pr.ID).with(autoApprove
        ? { status_code: 'A', decidedBy: 'system', decidedAt: new Date().toISOString(), rejectionReason: null }
        : { status_code: 'S', decidedBy: null, decidedAt: null, rejectionReason: null })

      req.info(autoApprove ? 'AUTO_APPROVED' : 'SUBMITTED', [autoApprovalLimit])
      return readActive(pr.ID)
    })

    this.on('withdraw', PurchaseRequisitions, async req => {
      const pr = await loadOwn(req)
      if (pr.status_code !== 'S') return req.reject(409, 'WITHDRAW_INVALID_STATUS')
      await UPDATE(db.PurchaseRequisitions, pr.ID).with({ status_code: 'N' })
      req.info('WITHDRAWN')
      return readActive(pr.ID)
    })

    return super.init()
  }
}
