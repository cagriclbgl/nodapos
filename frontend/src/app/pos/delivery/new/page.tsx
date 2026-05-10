import { DeliveryOrderScreen } from "./delivery-order-screen";

// Async searchParams per Next.js 16. See
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
export default async function DeliveryNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const callId = typeof sp.callId === "string" ? sp.callId : null;
  const customerId = typeof sp.customerId === "string" ? sp.customerId : null;
  const prefillPhone =
    typeof sp.prefillPhone === "string" ? sp.prefillPhone : null;
  return (
    <DeliveryOrderScreen
      callId={callId}
      customerId={customerId}
      prefillPhone={prefillPhone}
    />
  );
}
