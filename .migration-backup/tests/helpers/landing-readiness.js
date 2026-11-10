const MAX_SCROLL_STEPS = 60;
const SCROLL_SETTLE_MS = 75;

/**
 * Deferred landing sections are mounted when their placeholder approaches the
 * viewport. Scroll through the page to trigger that contract instead of
 * waiting for a selector that cannot exist until the observer fires.
 */
export async function revealLandingSection(page, sectionLocator) {
  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    if (await sectionLocator.count() > 0) {
      await sectionLocator.scrollIntoViewIfNeeded();
      return;
    }

    await page.evaluate(() => {
      const scrollingElement = document.scrollingElement;
      if (!scrollingElement) return;
      const nextTop = Math.min(
        scrollingElement.scrollTop + Math.max(window.innerHeight * 0.8, 400),
        scrollingElement.scrollHeight,
      );
      scrollingElement.scrollTo(0, nextTop);
    });
    await page.waitForTimeout(SCROLL_SETTLE_MS);
  }

  throw new Error("Landing section did not become available after bounded scrolling");
}