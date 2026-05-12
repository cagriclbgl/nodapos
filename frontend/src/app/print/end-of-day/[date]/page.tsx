import { EndOfDayReceiptView } from "./end-of-day-receipt-view";

// Next.js 16 async params.
export default async function EndOfDayPrintPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return <EndOfDayReceiptView date={date} />;
}
