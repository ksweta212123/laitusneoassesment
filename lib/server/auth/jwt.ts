import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

/**
 * The access token is a signed JWT carrying only identity pointers. Role and
 * permissions are deliberately not in it: the API reads those from the database
 * on every request so a permission change takes effect immediately.
 */
export type AccessClaims = {
  sub: string; // user id
  sid: string; // session id
  jti: string;
  iat: number;
  exp: number;
};

const ISSUER = "udyogpay-console";
/** Seconds of clock disagreement tolerated between the signer and the verifier. */
const CLOCK_TOLERANCE_SECONDS = 5;

export async function signAccessToken(input: {
  userId: string;
  sessionId: string;
  ttlSeconds: number;
  secret: Uint8Array;
  now: Date;
}): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = crypto.randomUUID();
  const iat = Math.floor(input.now.getTime() / 1000);
  const exp = iat + input.ttlSeconds;
  const token = await new SignJWT({ sid: input.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(input.secret);
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: "token_expired" | "token_invalid" };

export async function verifyAccessToken(token: string, secret: Uint8Array, now?: Date): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now,
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.jti !== "string") {
      return { ok: false, reason: "token_invalid" };
    }
    return {
      ok: true,
      claims: { sub: payload.sub, sid: payload.sid, jti: payload.jti, iat: payload.iat!, exp: payload.exp! },
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: "token_expired" };
    return { ok: false, reason: "token_invalid" };
  }
}
