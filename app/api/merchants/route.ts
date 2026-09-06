import { withAuth } from "@/lib/server/auth/authenticate";
import { jsonOk } from "@/lib/server/http/responses";
import { listMerchants } from "@/lib/server/merchants/repo";
import type { MerchantListResponse } from "@/lib/shared/api";

export const GET = withAuth(async () =>
  jsonOk<MerchantListResponse>({ merchants: await listMerchants(), asOf: new Date().toISOString() }),
);
