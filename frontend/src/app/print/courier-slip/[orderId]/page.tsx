import { CourierSlipView } from "./courier-slip-view";

// Async params per Next.js 16. See
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
export default async function CourierSlipPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <CourierSlipView orderId={orderId} />;
}
