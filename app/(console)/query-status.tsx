"use client";
import { Button } from "@/app/_ui";
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
    <div
      role="alert"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
        <span>
          {stale ? (
            <>
              Showing data as of {loadedAt ? new Date(loadedAt).toLocaleTimeString("en-IN") : "earlier"}; the latest
              reload failed: {describeError(error)}
            </>
          ) : (
            describeError(error)
          )}
        </span>
      </p>
      {/* The label stays "Retry" in every state: it is how the operator finds the
          control again, and it is what the browser tests click. */}
      <Button type="button" onClick={reload} disabled={loading} variant="secondary" size="sm">
        Retry
      </Button>
    </div>
  );
}
