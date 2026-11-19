using RequisitionService as service from '../../srv/requisition-service';

// ------------------------------------------------------------------
// App "Meine Bestellanforderungen" (List Report + Object Page)
// ------------------------------------------------------------------

annotate service.PurchaseRequisitions with @(
  UI.UpdateHidden          : editHidden,
  UI.DeleteHidden          : deleteHidden,

  UI.HeaderInfo            : {
    TypeName      : '{i18n>PurchaseRequisition}',
    TypeNamePlural: '{i18n>PurchaseRequisitions}',
    Title         : { Value: title },
    Description   : { Value: requisitionNo }
  },

  UI.SelectionFields       : [ status_code, costCenter_ID, priority_code, neededBy ],

  UI.LineItem              : [
    { Value: requisitionNo, ![@UI.Importance]: #High },
    { Value: title, ![@UI.Importance]: #High },
    { Value: costCenter_ID, ![@UI.Importance]: #High },
    { Value: priority_code, ![@UI.Importance]: #High },
    { Value: neededBy, ![@UI.Importance]: #High },
    { Value: totalAmount, ![@UI.Importance]: #High },
    { Value: status_code, Criticality: status.criticality, ![@UI.Importance]: #High },
    { $Type: 'UI.DataFieldForAction', Action: 'RequisitionService.submit', Label: '{i18n>Submit}' }
  ],

  UI.PresentationVariant   : {
    SortOrder     : [{ Property: requisitionNo, Descending: true }],
    Visualizations: ['@UI.LineItem']
  },

  UI.HeaderFacets          : [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Status' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Total' }
  ],
  UI.DataPoint #Status     : { Value: status_code, Title: '{i18n>Status}', Criticality: status.criticality },
  UI.DataPoint #Total      : { Value: totalAmount, Title: '{i18n>TotalAmount}' },

  UI.Identification        : [
    { $Type: 'UI.DataFieldForAction', Action: 'RequisitionService.submit',   Label: '{i18n>Submit}' },
    { $Type: 'UI.DataFieldForAction', Action: 'RequisitionService.withdraw', Label: '{i18n>Withdraw}' }
  ],

  UI.Facets                : [
    { $Type: 'UI.ReferenceFacet', ID: 'General',  Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Items',    Label: '{i18n>Items}',              Target: 'items/@UI.LineItem' },
    { $Type: 'UI.ReferenceFacet', ID: 'Decision', Label: '{i18n>Decision}',           Target: '@UI.FieldGroup#Decision' },
    { $Type: 'UI.ReferenceFacet', ID: 'Admin',    Label: '{i18n>Administrative}',     Target: '@UI.FieldGroup#Admin' }
  ],
  UI.FieldGroup #General   : { Data: [
    { Value: title },
    { Value: description },
    { Value: costCenter_ID, ![@UI.Importance]: #High },
    { Value: priority_code, ![@UI.Importance]: #High },
    { Value: neededBy }
  ]},
  UI.FieldGroup #Decision  : { Data: [
    { Value: decidedBy },
    { Value: decidedAt },
    { Value: rejectionReason }
  ]},
  UI.FieldGroup #Admin     : { Data: [
    { Value: createdBy, ![@UI.Importance]: #High },
    { Value: createdAt },
    { Value: modifiedAt }
  ]},

  // Gesamtwert neu lesen, wenn Positionen geändert werden
  Common.SideEffects #Items: {
    SourceEntities  : [ items ],
    TargetProperties: [ 'totalAmount' ]
  }
);

annotate service.Items with @(
  UI.HeaderInfo              : {
    TypeName      : '{i18n>Item}',
    TypeNamePlural: '{i18n>Items}',
    Title         : { Value: description }
  },
  UI.LineItem                : [
    { Value: itemNo },
    { Value: material_ID },
    { Value: description },
    { Value: quantity },
    { Value: unitPrice },
    { Value: netAmount }
  ],
  // Material gewählt -> Kurztext, Einheit, Preis werden vom Server vorbelegt
  Common.SideEffects #Material: {
    SourceProperties: [ material_ID ],
    TargetProperties: [ 'description', 'unit', 'unitPrice', 'netAmount' ]
  },
  Common.SideEffects #Amount  : {
    SourceProperties: [ quantity, unitPrice ],
    TargetProperties: [ 'netAmount' ]
  }
);
