import { withAuth } from "@/lib/server/auth/authenticate";
import { jsonError, jsonOk, readJsonBody, rejectCrossSite } from "@/lib/server/http/responses";
import { getMerchant, isUuid, setMerchantStatus } from "@/lib/server/merchants/repo";
import type { MerchantDetailResponse, MerchantStatusRequest } from "@/lib/shared/api";

/** Admin-only: suspend or reinstate a merchant. The viewer role gets a 403, never a sign-out. */
export const POST = withAuth<RouteContext<"/api/merchants/[id]/status">>(
  async (req, ctx, auth) => {
    const crossSite = rejectCrossSite(req);
    if (crossSite) return crossSite;

    const { id } = await ctx.params;
    const body = await readJsonBody<MerchantStatusRequest>(req);
    if (body?.status !== "active" && body?.status !== "suspended") {
      return jsonError(400, "invalid_request", 'status must be "active" or "suspended".');
    }
    if (!isUuid(id) || (await setMerchantStatus(id, body.status, auth.user.id)) === "not_found") {
      return jsonError(404, "not_found", "No merchant with that id.");
    }
    const merchant = await getMerchant(id);
    return jsonOk<MerchantDetailResponse>({ merchant: merchant!, asOf: new Date().toISOString() });
  },
  { role: "admin" },
);
