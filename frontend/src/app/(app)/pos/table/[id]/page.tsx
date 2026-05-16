import { OrderScreen } from "./order-screen";

// Async params per Next.js 16 — see node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
export default async function PosTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderScreen tableId={id} />;
}
