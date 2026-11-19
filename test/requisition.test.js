import cds from '@sap/cds'

const { GET, POST, PATCH, DELETE, expect } = cds.test(import.meta.dirname + '/..')

const REQ = '/odata/v4/requisitions'
const APP = '/odata/v4/approvals'
const as = username => ({ auth: { username, password: 'demo' } })

const inFuture = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
const draft = ID => `${REQ}/PurchaseRequisitions(ID=${ID},IsActiveEntity=false)`
const active = ID => `${REQ}/PurchaseRequisitions(ID=${ID},IsActiveEntity=true)`

/** Legt eine Bestellanforderung als Entwurf an, fügt Positionen hinzu und aktiviert sie */
async function createRequisition(user, items, header = {}) {
  const { data: pr } = await POST(`${REQ}/PurchaseRequisitions`, {
    title: 'Testanforderung',
    costCenter_ID: '2200',
    neededBy: inFuture(30),
    ...header
  }, as(user))
  for (const item of items) await POST(`${draft(pr.ID)}/items`, item, as(user))
  const { data } = await POST(`${draft(pr.ID)}/RequisitionService.draftActivate`, {}, as(user))
  return data
}

const submit = (ID, user) => POST(`${active(ID)}/RequisitionService.submit`, {}, as(user))
const approve = (ID, user) =>
  POST(`${APP}/PurchaseRequisitions(${ID})/ApprovalService.approveRequisition`, {}, as(user))
const reject = (ID, user, reason) =>
  POST(`${APP}/PurchaseRequisitions(${ID})/ApprovalService.rejectRequisition`, { reason }, as(user))

describe('Bestellanforderung anlegen', () => {

  it('vergibt Nummer, Positionsnummern und berechnet den Gesamtwert', async () => {
    const pr = await createRequisition('anna', [
      { material_ID: 'MON-2701', quantity: 2 },                                // Preis aus Materialstamm
      { description: 'Sonderanfertigung', quantity: 1, unit: 'ST', unitPrice: 100 }
    ])
    expect(pr.requisitionNo).to.match(/^1\d{7}$/)
    expect(pr.status_code).to.equal('N')
    expect(Number(pr.totalAmount)).to.equal(878)

    const { data } = await GET(`${active(pr.ID)}/items?$orderby=itemNo`, as('anna'))
    expect(data.value.map(i => i.itemNo)).to.eql([10, 20])
    expect(data.value[0]).to.include({ description: 'Monitor 27 Zoll, 4K', unit: 'ST' })
    expect(Number(data.value[0].netAmount)).to.equal(778)
  })

  it('aktualisiert den Gesamtwert schon im Entwurf', async () => {
    const { data: pr } = await POST(`${REQ}/PurchaseRequisitions`,
      { title: 'Entwurf', costCenter_ID: '1000', neededBy: inFuture(10) }, as('anna'))
    const { data: item } = await POST(`${draft(pr.ID)}/items`, { material_ID: 'NB-1001', quantity: 1 }, as('anna'))
    await PATCH(`${REQ}/Items(ID=${item.ID},IsActiveEntity=false)`, { quantity: 3 }, as('anna'))

    let { data } = await GET(draft(pr.ID), as('anna'))
    expect(Number(data.totalAmount)).to.equal(4350)

    await DELETE(`${REQ}/Items(ID=${item.ID},IsActiveEntity=false)`, as('anna'))
    ;({ data } = await GET(draft(pr.ID), as('anna')))
    expect(Number(data.totalAmount)).to.equal(0)
  })

  it('lehnt ein "Benötigt bis"-Datum in der Vergangenheit ab', async () => {
    const { data: pr } = await POST(`${REQ}/PurchaseRequisitions`,
      { title: 'Zu spät', costCenter_ID: '1000', neededBy: '2020-01-01' }, as('anna'))
    await POST(`${draft(pr.ID)}/items`, { material_ID: 'PAP-A4-500', quantity: 1 }, as('anna'))
    await expect(POST(`${draft(pr.ID)}/RequisitionService.draftActivate`, {}, as('anna')))
      .to.be.rejectedWith(/past|Vergangenheit/)
  })

  it('lehnt Mengen kleiner oder gleich null ab', async () => {
    const { data: pr } = await POST(`${REQ}/PurchaseRequisitions`,
      { title: 'Menge 0', costCenter_ID: '1000', neededBy: inFuture(5) }, as('anna'))
    await POST(`${draft(pr.ID)}/items`, { material_ID: 'PAP-A4-500', quantity: 0 }, as('anna'))
    await expect(POST(`${draft(pr.ID)}/RequisitionService.draftActivate`, {}, as('anna')))
      .to.be.rejectedWith(/greater than zero|größer als null/)
  })
})

describe('Berechtigungen', () => {

  it('Anforderer sehen nur ihre eigenen Bestellanforderungen', async () => {
    const { data } = await GET(`${REQ}/PurchaseRequisitions?$filter=IsActiveEntity eq true`, as('anna'))
    expect(data.value.length).to.be.greaterThan(0)
    expect(data.value.every(pr => pr.createdBy === 'anna')).to.be.true
  })

  it('Genehmiger ohne Anforderer-Rolle haben keinen Zugriff auf den Anforderer-Service', async () => {
    await expect(GET(`${REQ}/PurchaseRequisitions`, as('carla'))).to.be.rejectedWith(/403|Forbidden/)
  })

  it('Anforderer haben keinen Zugriff auf den Freigabe-Service', async () => {
    await expect(GET(`${APP}/PurchaseRequisitions`, as('anna'))).to.be.rejectedWith(/403|Forbidden/)
  })
})

describe('Freigabeprozess', () => {

  it('gibt Anforderungen bis zur Wertgrenze automatisch frei', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'PAP-A4-500', quantity: 10 }])
    const { data } = await submit(pr.ID, 'anna')
    expect(data).to.include({ status_code: 'A', decidedBy: 'system' })
  })

  it('verlangt eine Position vor dem Einreichen', async () => {
    const pr = await createRequisition('anna', [])
    await expect(submit(pr.ID, 'anna')).to.be.rejectedWith(/at least one item|mindestens eine Position/)
  })

  it('Einreichen -> Genehmiger gibt frei', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'NB-1001', quantity: 2 }])
    expect((await submit(pr.ID, 'anna')).data.status_code).to.equal('S')

    const { data } = await approve(pr.ID, 'carla')
    expect(data).to.include({ status_code: 'A', decidedBy: 'carla' })
  })

  it('eingereichte Anforderungen können nicht mehr bearbeitet werden', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'NB-1001', quantity: 1 }])
    await submit(pr.ID, 'anna')
    await expect(POST(`${active(pr.ID)}/RequisitionService.draftEdit`, {}, as('anna')))
      .to.be.rejectedWith(/Only new or rejected|Nur neue oder abgelehnte/)
  })

  it('eingereichte Anforderungen können nicht gelöscht werden', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'NB-1001', quantity: 1 }])
    await submit(pr.ID, 'anna')
    await expect(DELETE(active(pr.ID), as('anna')))
      .to.be.rejectedWith(/Only new purchase requisitions|Nur neue Bestellanforderungen/)
  })

  it('Vier-Augen-Prinzip: eigene Anforderung kann nicht freigegeben werden', async () => {
    const pr = await createRequisition('ben', [{ material_ID: 'NB-1001', quantity: 1 }])
    await submit(pr.ID, 'ben')
    await expect(approve(pr.ID, 'ben')).to.be.rejectedWith(/Segregation of duties|Vier-Augen/)
  })

  it('über der Managergrenze darf nur die Einkaufsleitung freigeben', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'SRV-4410', quantity: 2 }])
    await submit(pr.ID, 'anna')
    await expect(approve(pr.ID, 'carla')).to.be.rejectedWith(/purchasing management|Einkaufsleitung/)

    const { data } = await approve(pr.ID, 'david')
    expect(data).to.include({ status_code: 'A', decidedBy: 'david' })
  })

  it('Ablehnung braucht einen Grund, danach kann neu eingereicht werden', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'CHAIR-ERG', quantity: 4 }])
    await submit(pr.ID, 'anna')

    await expect(reject(pr.ID, 'carla', '   ')).to.be.rejected
    const { data } = await reject(pr.ID, 'carla', 'Bitte günstigeres Modell wählen.')
    expect(data).to.include({ status_code: 'R', rejectionReason: 'Bitte günstigeres Modell wählen.' })

    // Anforderer passt die Menge an und reicht erneut ein
    await POST(`${active(pr.ID)}/RequisitionService.draftEdit`, { PreserveChanges: true }, as('anna'))
    const { data: items } = await GET(`${draft(pr.ID)}/items`, as('anna'))
    await PATCH(`${REQ}/Items(ID=${items.value[0].ID},IsActiveEntity=false)`, { quantity: 1 }, as('anna'))
    await POST(`${draft(pr.ID)}/RequisitionService.draftActivate`, {}, as('anna'))

    const { data: again } = await submit(pr.ID, 'anna')
    expect(again).to.include({ status_code: 'A', rejectionReason: null })   // 549 EUR -> automatisch frei
  })

  it('eine Anforderung kann nicht zweimal entschieden werden', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'NB-1001', quantity: 1 }])
    await submit(pr.ID, 'anna')
    await approve(pr.ID, 'carla')
    await expect(reject(pr.ID, 'david', 'zu spät')).to.be.rejectedWith(/waiting for approval|Zur Freigabe/)
  })

  it('zurückziehen setzt den Status wieder auf "Neu"', async () => {
    const pr = await createRequisition('anna', [{ material_ID: 'NB-1001', quantity: 1 }])
    await submit(pr.ID, 'anna')
    const { data } = await POST(`${active(pr.ID)}/RequisitionService.withdraw`, {}, as('anna'))
    expect(data.status_code).to.equal('N')
  })
})
