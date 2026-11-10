import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let vite: ViteDevServer, Catalog: any, root: ReactTestRenderer | undefined;
test.before(async () => {
  vite = await createServer({
    cacheDir: "node_modules/.vite-shared-knowledge-base-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom",
  });
  ({ default: Catalog } = await vite.ssrLoadModule("/src/components/chatbot/SharedKnowledgeBase.tsx"));
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); });

test("catalog separates 15643 PDF pages from 79 text lines across forty-five sources", async () => {
  await act(async () => { root = create(React.createElement(Catalog)); });
  assert.equal(root!.root.findAllByType("li").length, 45);
  const output = JSON.stringify(root!.toJSON());
  assert.match(output, /15643/);
  assert.match(output, /79 baris teks/);
  assert.match(output, /76 entri/);
  assert.match(output, /Publikasi statistik BPS/);
  assert.match(output, /Tabel pemetaan salinan/);
  assert.match(output, /bukan tabel konversi otomatis/);
  assert.match(output, /Peraturan Presiden/);
  assert.match(output, /Peraturan Lembaga/);
  assert.match(output, /bukan naskah konsolidasi lengkap/);
  assert.match(output, /100 halaman berulang/);
  assert.match(output, /Lampiran peraturan/);
  assert.match(output, /443 halaman/);
  assert.match(output, /bukan klaim kelengkapan seluruh lampiran/);
  assert.match(output, /Peraturan Pemerintah/);
  assert.match(output, /Peraturan Menteri/);
  assert.match(output, /kesalahan pengenalan karakter/);
  assert.match(output, /Format skema LSBU/);
  assert.match(output, /header menulis Konstruksi Prapabrikasi/);
  assert.match(output, /Keputusan dan surat/);
  assert.match(output, /Perspektif pelaku usaha/);
  assert.match(output, /ringkasan visual pindai/);
  assert.match(output, /6\/2025/);
  assert.match(output, /bukan knowledge base pribadi Mentor/);
});

test("source search filters the catalog and displays an explicit empty result", async () => {
  await act(async () => { root = create(React.createElement(Catalog)); });
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "kb03" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /Perspektif Pelaku Usaha/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "Penyewaan Peralatan" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /KB14/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB18" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /Pengembangan Usaha Berkelanjutan/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB19" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /Permen PU Nomor 6 Tahun 2025/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB28" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /I.F.5691/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB34" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /800 halaman/);
  assert.match(JSON.stringify(root!.toJSON()), /100 halaman berulang/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB43" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /Kerja Sama Pemerintah dan Badan Usaha/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB44" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /1040 halaman PDF/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "KB45" } }); });
  assert.equal(root!.root.findAllByType("li").length, 1);
  assert.match(JSON.stringify(root!.toJSON()), /76 entri · 79 baris teks/);
  assert.doesNotMatch(JSON.stringify(root!.toJSON()), /0 halaman PDF/);
  await act(async () => { root!.root.findByType("input").props.onChange({ target: { value: "nonexistent-file-xyz" } }); });
  assert.equal(root!.root.findAllByType("li").length, 0);
  assert.match(root!.root.findByProps({ role: "status" }).children.join(""), /Tidak ada sumber/);
});
