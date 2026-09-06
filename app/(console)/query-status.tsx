"use client";
import { ApiError, NetworkError, SignedOutError } from "@/lib/client/api";

/**
 * One place that turns a failed load into words. A 403 says "not allowed",
 * a network failure says "could not reach", and neither ever says "sign in".
 */
export function describeError(error: Error): string {
  if (error instanceof SignedOutError) return "Signing you out…";
  if (error instanceof NetworkError) return "Could not reach the server.";
  if (error instanceof ApiError) {
    if (error.status === 403) return "You do not have permission to do this.";
    if (error.status === 404) return "Not found.";
    return error.message;
  }
  return "Something went wrong.";
}

export function QueryStatus({
  error,
  stale,
  loading,
  loadedAt,
  reload,
}: {
  error: Error | undefined;
  stale: boolean;
  loading: boolean;
  loadedAt: number | undefined;
  reload: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {stale ? (
        <>
          Showing data as of {loadedAt ? new Date(loadedAt).toLocaleTimeString("en-IN") : "earlier"}; the latest
          reload failed: {describeError(error)}
        </>
      ) : (
        describeError(error)
      )}{" "}
      <button type="button" onClick={reload} disabled={loading} className="underline disabled:opacity-50">
        Retry
      </button>
    </div>
  );
}
