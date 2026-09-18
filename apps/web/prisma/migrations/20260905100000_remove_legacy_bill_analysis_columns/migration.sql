-- The canonical analysis result lives in analysis_results.resultSnapshot.
-- No production data exists for these superseded BillHeader projections.
ALTER TABLE "bills_header"
  DROP COLUMN "percentage",
  DROP COLUMN "reason";
