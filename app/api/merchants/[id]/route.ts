import { withAuth } from "@/lib/server/auth/authenticate";
import { jsonError, jsonOk } from "@/lib/server/http/responses";
import { getMerchant, isUuid } from "@/lib/server/merchants/repo";
import type { MerchantDetailResponse } from "@/lib/shared/api";

export const GET = withAuth<RouteContext<"/api/merchants/[id]">>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const merchant = isUuid(id) ? await getMerchant(id) : null;
  if (!merchant) return jsonError(404, "not_found", "No merchant with that id.");
  return jsonOk<MerchantDetailResponse>({ merchant, asOf: new Date().toISOString() });
});
