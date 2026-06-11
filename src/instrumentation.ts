import * as Sentry from "@sentry/nextjs";
import { isBenignConnectionError } from "@/lib/sentry-error-filters";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Dev: client aborts during slow compiles/HMR should not spam uncaughtException logs.
    process.on("uncaughtException", (error) => {
      if (isBenignConnectionError(error)) return;
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (
  error,
  request,
  errorContext,
) => {
  if (isBenignConnectionError(error)) return;
  Sentry.captureRequestError(error, request, errorContext);
};
