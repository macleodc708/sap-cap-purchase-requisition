using { sap.portfolio.pr as db } from '../db/schema';

// ------------------------------------------------------------------
// Gemeinsame Annotationen für beide Apps (Texte, Wertehilfen)
// ------------------------------------------------------------------

annotate db.PurchaseRequisitions with {
  ID         @UI.Hidden;
  costCenter @Common: { Text: costCenter.name, TextArrangement: #TextFirst };
  priority   @Common: { Text: priority.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  status     @Common: { Text: status.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  createdBy  @title: '{i18n>CreatedBy}';
};

annotate db.Items with {
  ID       @UI.Hidden;
  parent   @UI.Hidden;
  material @Common: { Text: material.name, TextArrangement: #TextLast };
};

annotate db.CostCenters with {
  ID @Common: { Text: name, TextArrangement: #TextFirst };
};

annotate db.Materials with {
  ID @Common: { Text: name, TextArrangement: #TextLast };
};

annotate db.Status with {
  code @Common: { Text: name, TextArrangement: #TextOnly };
};

annotate db.Priorities with {
  code @Common: { Text: name, TextArrangement: #TextOnly };
};
