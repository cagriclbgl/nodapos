import { ReceiptView } from "./receipt-view";

// Async params per Next.js 16. See
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <ReceiptView orderId={orderId} />;
}
