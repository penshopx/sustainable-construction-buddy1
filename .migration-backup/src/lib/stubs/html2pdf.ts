interface Html2PdfWorker {
  set(options: Record<string, unknown>): Html2PdfWorker;
  from(source: HTMLElement): Html2PdfWorker;
  save(): Promise<void>;
}

const worker: Html2PdfWorker = {
  set: () => worker,
  from: () => worker,
  save: () => Promise.resolve(),
};

const html2pdf = (): Html2PdfWorker => worker;

export default html2pdf;
