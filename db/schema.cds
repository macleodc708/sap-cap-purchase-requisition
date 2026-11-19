namespace sap.portfolio.pr;

using {
  cuid,
  managed,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';

/**
 * Bestellanforderung (BANF) – Kopf
 */
entity PurchaseRequisitions : cuid, managed {
  requisitionNo   : String(10)    @title: '{i18n>RequisitionNo}'  @readonly;
  title           : String(80)    @title: '{i18n>Title}'          @mandatory;
  description     : String(1000)  @title: '{i18n>Description}'    @UI.MultiLineText;
  costCenter      : Association to CostCenters @title: '{i18n>CostCenter}' @mandatory;
  priority        : Association to Priorities  @title: '{i18n>Priority}';
  neededBy        : Date          @title: '{i18n>NeededBy}'       @mandatory;
  status          : Association to Status      @title: '{i18n>Status}'   @readonly;
  totalAmount     : Decimal(15, 2) @title: '{i18n>TotalAmount}'   @readonly  @Measures.ISOCurrency: currency_code;
  currency        : Currency;
  decidedBy       : String(255)   @title: '{i18n>DecidedBy}'      @readonly;
  decidedAt       : Timestamp     @title: '{i18n>DecidedAt}'      @readonly;
  rejectionReason : String(500)   @title: '{i18n>RejectionReason}' @readonly;
  items           : Composition of many Items on items.parent = $self;

  // Steuert in der UI, ob "Bearbeiten" / "Löschen" angeboten werden
  editHidden      : Boolean = (status.code = 'S' or status.code = 'A')  @UI.Hidden;
  deleteHidden    : Boolean = (status.code <> 'N')                      @UI.Hidden;
}

/**
 * Bestellanforderung – Position
 */
entity Items : cuid {
  parent      : Association to PurchaseRequisitions;
  itemNo      : Integer        @title: '{i18n>ItemNo}'      @readonly;
  material    : Association to Materials @title: '{i18n>Material}';
  description : String(100)    @title: '{i18n>ItemDescription}' @mandatory;
  quantity    : Decimal(13, 3) @title: '{i18n>Quantity}'    @mandatory  @Measures.Unit: unit;
  unit        : String(3)      @title: '{i18n>Unit}';
  unitPrice   : Decimal(15, 2) @title: '{i18n>UnitPrice}'   @mandatory  @Measures.ISOCurrency: parent.currency_code;
  netAmount   : Decimal(15, 2) = quantity * unitPrice
                               @title: '{i18n>NetAmount}'   @Measures.ISOCurrency: parent.currency_code;
}

/**
 * Kostenstelle (vereinfacht, angelehnt an CO-Stammdaten)
 */
@cds.odata.valuelist
entity CostCenters {
  key ID      : String(10)  @title: '{i18n>CostCenter}';
      name    : String(60)  @title: '{i18n>Name}';
      manager : String(60)  @title: '{i18n>Manager}';
}

/**
 * Material (vereinfacht, angelehnt an den Materialstamm)
 */
@cds.odata.valuelist
entity Materials {
  key ID            : String(18)    @title: '{i18n>Material}';
      name          : String(60)    @title: '{i18n>Name}';
      materialGroup : String(9)     @title: '{i18n>MaterialGroup}';
      unit          : String(3)     @title: '{i18n>Unit}';
      price         : Decimal(15, 2) @title: '{i18n>StandardPrice}';
}

/**
 * Status einer Bestellanforderung
 *   N = Neu, S = Zur Freigabe, A = Freigegeben, R = Abgelehnt
 */
entity Status : CodeList {
  key code        : String(1) enum {
        New       = 'N';
        Submitted = 'S';
        Approved  = 'A';
        Rejected  = 'R';
      };
      criticality : Integer;
}

entity Priorities : CodeList {
  key code : String(1) enum {
        Low    = 'L';
        Medium = 'M';
        High   = 'H';
      };
}
