type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    // Replit injects this tracker through the publishing proxy when Project
    // Analytics is enabled. It must not be initialized again in the app.
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}