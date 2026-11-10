# Native video network recovery

Run from the workspace root:

```sh
pnpm --filter @workspace/pub-aspekindo exec playwright install chromium
pnpm --filter @workspace/pub-aspekindo run test:media
```

Requires `ffmpeg` (with the `libvpx` encoder) on PATH. On Linux CI install
Chromium with `playwright install --with-deps chromium`. A preinstalled browser
can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The suite generates a synthetic 90-second VP8 WebM locally under the ignored
`generated-artifacts/native-media/` directory. No external video, login,
Supabase credentials, production data, or active preview server is used.
The test-only Vite server exports the actual private `VideoMaterialPlayer`
from `AspekindoLmsNative.tsx`, stubs only its data/auth hooks, and loads the real
`lmsVideoRecovery.ts`. It uses its own dependency cache, not the preview's cache.

The HTTP server implements byte ranges, throttles real response bodies, can
hold them open, or destroys sockets before Content-Length is satisfied.
While disconnected it returns 503 to continuation requests: otherwise Chromium
transparently resumes each truncated response and can keep playing indefinitely.
The URL and its fresh issue time remain unchanged during recovery.

Assertions cover position restoration and Range requests after a network error,
recovery before retry with no restart, native `load()` resetting a buffering
element (then `emptied`/`loadedmetadata`), and exhaustion after three reloads (including no
more requests after the terminal message). Timers run at real speed. Native
events and media state are never synthesized; the `load()` observer calls the
original browser method. A deliberate button click starts playback; autoplay
policy and lesson switching are outside this suite.

Chromium emits `error` then `pause` on a failed stream, but `load()` can reset
`paused` without emitting another `pause`. Tests record both rather than impose
the simulated media object's event sequence on the real browser.

Each test saves `native-media-evidence.json` with HTTP ranges/statuses, socket
cuts, native load calls, and trusted media events. Failed tests also retain a
Playwright trace under `test-results/native-media/`. CI runs the suite and
uploads this evidence on failure.
