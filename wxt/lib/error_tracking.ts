import * as Sentry from "@sentry/browser";

export const ERROR_TRACKING_STORAGE_KEY = "errorReportingEnabled";

export function try_error_tracking(fn) {
  async function wrapped(...args) {
    try {
      return await fn(...args);
    } catch (e) {
      console.error("Error caught in try_error_tracking:", e);

      const shouldReport =
        (await chrome.storage.local.get(ERROR_TRACKING_STORAGE_KEY))[ERROR_TRACKING_STORAGE_KEY] !== false;

      if (shouldReport) {
        Sentry.init({
          dsn: "https://776b25b815cbfc8fde6c3cc076ce9499@o4506129351114752.ingest.us.sentry.io/4510182695501824",
          sendDefaultPii: false,
        });
        Sentry.captureException(e);
      }

      throw e;
    }
  }
  return wrapped;
}
