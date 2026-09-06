import { MerchantDetailView } from "./merchant-detail";

export default async function MerchantPage({ params }: PageProps<"/merchants/[id]">) {
  const { id } = await params;
  return <MerchantDetailView id={id} />;
}
