using { sap.portfolio.pr as db } from '../db/schema';

/**
 * Service für Genehmiger: eingereichte Bestellanforderungen
 * prüfen, freigeben oder ablehnen.
 */
@path    : 'approvals'
@requires: 'Approver'
service ApprovalService {

  @readonly
  entity PurchaseRequisitions as projection on db.PurchaseRequisitions
    where status.code != 'N'
    actions {

      @Common.SideEffects: { TargetProperties: ['in/status_code', 'in/decidedBy', 'in/decidedAt'] }
      @Core.OperationAvailable: ( $self.status.code = 'S' )
      action approveRequisition() returns PurchaseRequisitions;

      @Common.SideEffects: { TargetProperties: ['in/status_code', 'in/decidedBy', 'in/decidedAt', 'in/rejectionReason'] }
      @Core.OperationAvailable: ( $self.status.code = 'S' )
      action rejectRequisition(
        reason : String(500) @mandatory @title: '{i18n>RejectionReason}' @UI.MultiLineText
      )        returns PurchaseRequisitions;
    };

  @readonly entity Items       as projection on db.Items;
  @readonly entity CostCenters as projection on db.CostCenters;
  @readonly entity Materials   as projection on db.Materials;
  @readonly entity Status      as projection on db.Status;
  @readonly entity Priorities  as projection on db.Priorities;
}
