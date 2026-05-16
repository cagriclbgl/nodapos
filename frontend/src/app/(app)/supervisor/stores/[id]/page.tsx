import { StoreDetail } from "./store-detail";

export default async function SupervisorStorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoreDetail storeId={id} />;
}
