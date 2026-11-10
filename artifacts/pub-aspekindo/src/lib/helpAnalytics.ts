import { trackEvent } from "./analytics.ts";
import {
  getHelpLocationForPath,
  getHelpSectionForPath,
  type HelpSectionId,
} from "./helpGuide.ts";

export function trackHelpCenterOpened(pathname: string): void {
  const section = getHelpSectionForPath(pathname);
  const location = getHelpLocationForPath(pathname);

  trackEvent("help_center_opened", { section, location });
}

export function trackHelpTopicSelected(section: HelpSectionId): void {
  trackEvent("help_topic_selected", {
    section,
    location: "help_center",
  });
}