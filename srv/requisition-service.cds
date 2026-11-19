using { sap.portfolio.pr as db } from '../db/schema';

/**
 * Service für Anforderer: eigene Bestellanforderungen anlegen,
 * bearbeiten und zur Freigabe einreichen.
 */
@path    : 'requisitions'
@requires: 'Requester'
service RequisitionService {

  @odata.draft.enabled
  @restrict: [{ grant: '*', where: 'createdBy = $user' }]
  entity PurchaseRequisitions as projection on db.PurchaseRequisitions actions {

    @Common.SideEffects: { TargetProperties: ['in/status_code', 'in/decidedBy', 'in/decidedAt'] }
    @Core.OperationAvailable: ( $self.status.code = 'N' or $self.status.code = 'R' )
    action submit()   returns PurchaseRequisitions;

    @Common.SideEffects: { TargetProperties: ['in/status_code'] }
    @Core.OperationAvailable: ( $self.status.code = 'S' )
    action withdraw() returns PurchaseRequisitions;
  };

  @restrict: [{ grant: '*', where: 'parent.createdBy = $user' }]
  entity Items        as projection on db.Items;

  @readonly entity CostCenters as projection on db.CostCenters;
  @readonly entity Materials   as projection on db.Materials;
  @readonly entity Status      as projection on db.Status;
  @readonly entity Priorities  as projection on db.Priorities;
}
