using ApprovalService as service from '../../srv/approval-service';

// ------------------------------------------------------------------
// App "Bestellanforderungen freigeben" (List Report + Object Page)
// ------------------------------------------------------------------

annotate service.PurchaseRequisitions with {
  status @Common.FilterDefaultValue: 'S';   // standardmäßig nur offene Freigaben anzeigen
};

annotate service.PurchaseRequisitions with @(
  UI.HeaderInfo          : {
    TypeName      : '{i18n>PurchaseRequisition}',
    TypeNamePlural: '{i18n>PurchaseRequisitions}',
    Title         : { Value: title },
    Description   : { Value: requisitionNo }
  },

  UI.SelectionFields     : [ status_code, createdBy, costCenter_ID, priority_code ],

  UI.LineItem            : [
    { Value: requisitionNo, ![@UI.Importance]: #High },
    { Value: title, ![@UI.Importance]: #High },
    { Value: createdBy, ![@UI.Importance]: #High },
    { Value: costCenter_ID, ![@UI.Importance]: #High },
    { Value: priority_code, ![@UI.Importance]: #High },
    { Value: neededBy, ![@UI.Importance]: #High },
    { Value: totalAmount, ![@UI.Importance]: #High },
    { Value: status_code, Criticality: status.criticality, ![@UI.Importance]: #High }
  ],

  UI.PresentationVariant : {
    SortOrder     : [{ Property: neededBy }],
    Visualizations: ['@UI.LineItem']
  },

  UI.HeaderFacets        : [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Status' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Total' }
  ],
  UI.DataPoint #Status   : { Value: status_code, Title: '{i18n>Status}', Criticality: status.criticality },
  UI.DataPoint #Total    : { Value: totalAmount, Title: '{i18n>TotalAmount}' },

  UI.Identification      : [
    { $Type: 'UI.DataFieldForAction', Action: 'ApprovalService.approveRequisition', Label: '{i18n>Approve}' },
    { $Type: 'UI.DataFieldForAction', Action: 'ApprovalService.rejectRequisition',  Label: '{i18n>Reject}' }
  ],

  UI.Facets              : [
    { $Type: 'UI.ReferenceFacet', ID: 'General',  Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Items',    Label: '{i18n>Items}',              Target: 'items/@UI.LineItem' },
    { $Type: 'UI.ReferenceFacet', ID: 'Decision', Label: '{i18n>Decision}',           Target: '@UI.FieldGroup#Decision' }
  ],
  UI.FieldGroup #General : { Data: [
    { Value: createdBy, ![@UI.Importance]: #High },
    { Value: description },
    { Value: costCenter_ID, ![@UI.Importance]: #High },
    { Value: priority_code, ![@UI.Importance]: #High },
    { Value: neededBy }
  ]},
  UI.FieldGroup #Decision: { Data: [
    { Value: decidedBy },
    { Value: decidedAt },
    { Value: rejectionReason }
  ]}
);

annotate service.Items with @(
  UI.LineItem: [
    { Value: itemNo },
    { Value: material_ID },
    { Value: description },
    { Value: quantity },
    { Value: unitPrice },
    { Value: netAmount }
  ]
);
