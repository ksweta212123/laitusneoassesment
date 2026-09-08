import type { Money } from "@/lib/money/money";
import type { AuthFailureCode, Role } from "./auth";

export type ApiErrorBody = {
  error: { code: string; message: string; reason?: AuthFailureCode };
};

export type UserDto = { id: string; email: string; name: string; role: Role };

export type MeResponse = {
  user: UserDto;
  session: { id: string; createdAt: string; absoluteExpiresAt: string };
  accessToken: { jti: string; expiresAt: string };
};

export type LoginRequest = { email: string; password: string };
export type LoginResponse = { user: UserDto; session: { id: string } };

export type RefreshResponse = {
  /** true when a new refresh token was issued; false when a concurrent refresh already rotated it. */
  rotated: boolean;
  sessionId: string;
  accessToken: { jti: string; expiresAt: string };
  refreshToken?: { id: string; expiresAt: string };
};

export type MerchantStatus = "onboarding" | "active" | "suspended";
export type TransactionStatus = "pending" | "settled" | "failed";

export type MerchantSummary = {
  id: string;
  code: string;
  name: string;
  city: string;
  status: MerchantStatus;
  settledTotal: Money;
  transactionCount: number;
};

export type TransactionDto = {
  id: string;
  reference: string;
  amount: Money;
  status: TransactionStatus;
  createdAt: string;
};

export type MerchantDetail = MerchantSummary & {
  legalName: string;
  gstin: string;
  createdAt: string;
  statusChangedAt: string | null;
  pendingTotal: Money;
  transactions: TransactionDto[];
};

export type MerchantListResponse = { merchants: MerchantSummary[]; asOf: string };
export type MerchantDetailResponse = { merchant: MerchantDetail; asOf: string };
export type MerchantStatusRequest = { status: Extract<MerchantStatus, "active" | "suspended"> };
