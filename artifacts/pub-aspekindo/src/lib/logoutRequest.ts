export const LOGOUT_TIMEOUT_MS = 10_000;

export class LogoutTimeoutError extends Error {
  constructor() {
    super("Layanan belum mengonfirmasi logout. Status sesi belum dapat dipastikan.");
    this.name = "LogoutTimeoutError";
  }
}

/**
 * A timeout bounds the caller's wait, not the SDK's lifetime: signOut cannot be
 * cancelled. Keep its lock until it settles, including across provider remounts.
 */
export function createLogoutRequest(
  clearSession: (signal: AbortSignal) => Promise<void>,
  signOut: () => Promise<void>,
  timeoutMs = LOGOUT_TIMEOUT_MS,
) {
  let operation: Promise<void> | null = null;
  let waiting: Promise<void> | null = null;
  let controller: AbortController | null = null;

  return {
    get pending() { return operation !== null; },
    run(): Promise<void> {
      if (waiting) return waiting;
      if (!operation) {
        const abort = new AbortController();
        controller = abort;
        operation = (async () => {
          await clearSession(abort.signal);
          // An aborted DELETE can still respond late. Never start the next
          // stage after its deadline, even if the transport ignores abort.
          if (abort.signal.aborted) throw new LogoutTimeoutError();
          controller = null;
          await signOut();
        })();
        const current = operation;
        const release = () => {
          if (operation === current) {
            operation = null;
            controller = null;
          }
        };
        void current.then(release, release);
      }

      const current = operation;
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new LogoutTimeoutError());
          controller?.abort();
        }, timeoutMs);
      });
      const result = Promise.race([current, deadline]).finally(() => {
        clearTimeout(timer);
        if (waiting === result) waiting = null;
      });
      waiting = result;
      return result;
    },
  };
}
