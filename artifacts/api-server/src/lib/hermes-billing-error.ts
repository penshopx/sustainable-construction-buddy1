/** Only this fixed, server-owned billing failure may cross the worker error boundary. */
export class HermesBillingError extends Error {
  readonly status = 402;
  readonly code = "hermes_claude_billing";
  constructor() {
    super("Provider Claude menolak dengan status 402. Periksa saldo atau batas anggaran provider.");
  }
}
