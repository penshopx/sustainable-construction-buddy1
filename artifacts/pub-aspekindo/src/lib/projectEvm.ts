export type ProjectEvmInput = { bac: number; pv: number; ev: number; ac: number };
export type ProjectEvm = {
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
};

/** Snapshot EVM. EAC assumes remaining work continues at the current CPI.
 * TCPI targets the original BAC. Undefined/overflowing ratios stay unavailable.
 */
export function calculateProjectEvm({ bac, pv, ev, ac }: ProjectEvmInput): ProjectEvm {
  if (![bac, pv, ev, ac].every(value => Number.isFinite(value) && value >= 0) ||
      bac <= 0 || pv > bac || ev > bac) {
    throw new Error("BAC harus positif; PV, EV, dan AC tidak negatif. PV dan EV tidak boleh melebihi BAC.");
  }
  const finite = (value: number): number | null => Number.isFinite(value) ? value : null;
  const cpi = ac > 0 ? finite(ev / ac) : null;
  const spi = pv > 0 ? finite(ev / pv) : null;
  const eac = cpi !== null && cpi > 0 ? finite(bac / cpi) : null;
  return {
    cpi, spi, eac,
    etc: eac !== null ? finite(eac - ac) : null,
    vac: eac !== null ? finite(bac - eac) : null,
    tcpi: bac > ac ? finite((bac - ev) / (bac - ac)) : null,
  };
}
