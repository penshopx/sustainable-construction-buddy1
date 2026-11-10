// Model media state/events only: signed-URL HTTP requests still pass through
// the storage fixture. No codecs, real video bytes, or production hooks needed.
export async function installControlledVideo(page) {
  await page.addInitScript(() => {
    const states = new WeakMap();
    const state = (video) => {
      if (!states.has(video)) {
        states.set(video, { currentTime: 0, paused: true, ended: false, readyState: 1 });
      }
      return states.get(video);
    };
    window.controlledVideo = {
      playSources: [],
      rejectNextPlay: false,
      setState(video, patch) { Object.assign(state(video), patch); },
    };
    for (const property of ["currentTime", "paused", "ended", "readyState"]) {
      Object.defineProperty(HTMLMediaElement.prototype, property, {
        configurable: true,
        get() { return state(this)[property]; },
        ...(property === "currentTime" ? {
          set(value) { state(this).currentTime = value; },
        } : {}),
      });
    }
    HTMLMediaElement.prototype.play = function () {
      window.controlledVideo.playSources.push(this.querySelector("source")?.src);
      if (window.controlledVideo.rejectNextPlay) {
        window.controlledVideo.rejectNextPlay = false;
        state(this).paused = true;
        return Promise.reject(new DOMException("Autoplay is not allowed", "NotAllowedError"));
      }
      state(this).paused = false;
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      state(this).paused = true;
      this.dispatchEvent(new Event("pause"));
    };
  });
}

export async function signalVideo(video, event, state = {}) {
  await video.evaluate((element, { event, state }) => {
    window.controlledVideo.setState(element, state);
    element.dispatchEvent(new Event(event));
  }, { event, state });
}

export async function resumeControlledVideo(video, currentTime) {
  await signalVideo(video, "playing", { currentTime, paused: false, readyState: 4 });
  await signalVideo(video, "timeupdate");
}

// Install only after navigation/lesson animations settle. Pause the clock so
// the four-second stall grace period and URL age can be asserted exactly.
export async function freezeVideoClock(page) {
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));
}
