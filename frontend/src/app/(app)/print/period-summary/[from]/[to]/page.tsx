import { PeriodSummaryReceiptView } from "./period-summary-receipt-view";

// Next.js 16 async params.
export default async function PeriodSummaryPrintPage({
  params,
}: {
  params: Promise<{ from: string; to: string }>;
}) {
  const { from, to } = await params;
  return <PeriodSummaryReceiptView from={from} to={to} />;
}
