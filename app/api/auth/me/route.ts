import { withAuth } from "@/lib/server/auth/authenticate";
import { toUserDto } from "@/lib/server/auth/users";
import { jsonOk } from "@/lib/server/http/responses";
import type { MeResponse } from "@/lib/shared/api";

export const GET = withAuth(async (_req, _ctx, auth) =>
  jsonOk<MeResponse>({
    user: toUserDto(auth.user),
    session: {
      id: auth.session.id,
      createdAt: auth.session.createdAt.toISOString(),
      absoluteExpiresAt: auth.session.absoluteExpiresAt.toISOString(),
    },
    accessToken: { jti: auth.claims.jti, expiresAt: new Date(auth.claims.exp * 1000).toISOString() },
  }),
);
