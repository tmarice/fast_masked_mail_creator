import * as Sentry from "@sentry/browser";

// TODO Annotate for TS
async function try_error_tracking(fn) {
  async function wrapped(...args) {
    try {
      return await fn(...args);
    } catch (e) {
      console.error("Error caught in try_error_tracking:", e);

      Sentry.init({
        dsn: "https://776b25b815cbfc8fde6c3cc076ce9499@o4506129351114752.ingest.us.sentry.io/4510182695501824",
        // TODO Investigate PII, minimize since I only need data for issue reproduction
        sendDefaultPii: true,
      });

      Sentry.captureException(e);

      throw e;
    }
  }
  return wrapped;
}
