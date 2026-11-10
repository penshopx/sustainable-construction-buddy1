import { test } from "node:test";
import assert from "node:assert/strict";
import { freshSmapFileUrl, smapStoragePath, SMAP_SIGNED_URL_TTL } from "./smapFileAccess.ts";

const project = "https://example.supabase.co";
const path = "member-a/doc-a/sertifikat.pdf";
const url = `${project}/storage/v1/object/sign/smap-documents/${path}?token=OLD_TEST_TOKEN`;

test("SMAP memakai path berkas dan memulihkan URL lama tanpa meneruskan tokennya", () => {
  assert.equal(smapStoragePath(path, project, "member-a", "doc-a"), path);
  assert.equal(smapStoragePath(url, project, "member-a", "doc-a"), path);
  assert.equal(smapStoragePath(url.replace("sertifikat.pdf", "sertifikat%20ISO.pdf"), project, "member-a", "doc-a"),
    "member-a/doc-a/sertifikat ISO.pdf");
});

test("SMAP menolak URL asing, bucket salah, akun/dokumen lain dan path berbahaya tanpa membocorkan token", () => {
  for (const value of [
    url.replace(project, "https://attacker.invalid"),
    url.replace("https:", "http:"),
    url.replace("smap-documents", "another-bucket"),
    url.replace("member-a", "member-b"),
    url.replace("doc-a", "doc-b"),
    "member-a/doc-a/../secret.pdf",
    "member-a/doc-a/file.pdf?token=OLD_TEST_TOKEN",
    "member-a/doc-a\\secret.pdf",
    "javascript:alert('OLD_TEST_TOKEN')",
    "//attacker.invalid/OLD_TEST_TOKEN",
  ]) {
    assert.throws(() => smapStoragePath(value, project, "member-a", "doc-a"), (error: Error) => {
      assert.doesNotMatch(error.message, /OLD_TEST_TOKEN|attacker/);
      return true;
    });
  }
});

test("akses SMAP membuat tautan baru lima menit, tidak memakai URL lama meski tokennya tersedia", async () => {
  const calls: [string, number][] = [];
  const result = await freshSmapFileUrl(url, project, "member-a", "doc-a", async (objectPath, ttl) => {
    calls.push([objectPath, ttl]);
    return { data: { signedUrl: url.replace("OLD_TEST_TOKEN", "FRESH_TEST_TOKEN") }, error: null };
  });
  assert.equal(SMAP_SIGNED_URL_TTL, 300);
  assert.deepEqual(calls, [[path, 300]]);
  assert.match(result, /FRESH_TEST_TOKEN/);
  assert.doesNotMatch(result, /OLD_TEST_TOKEN/);
});

test("penandatanganan SMAP gagal tertutup, tanpa fallback URL setahun atau URL asing", async () => {
  for (const response of [
    { data: null, error: new Error("test-only-provider-error") },
    { data: { signedUrl: "" }, error: null },
    { data: { signedUrl: path }, error: null },
    { data: { signedUrl: url.replace(project, "https://attacker.invalid") }, error: null },
    { data: { signedUrl: url.replace("sertifikat.pdf", "another.pdf") }, error: null },
  ]) {
    await assert.rejects(freshSmapFileUrl(url, project, "member-a", "doc-a", async () => response),
      (error: Error) => {
        assert.doesNotMatch(error.message, /OLD_TEST_TOKEN|test-only-provider-error/);
        return true;
      });
  }
});

test("path lintas akun ditolak sebelum layanan penandatangan dipanggil", async () => {
  let calls = 0;
  await assert.rejects(freshSmapFileUrl(url, project, "member-b", "doc-a", async () => {
    calls += 1;
    return { data: null, error: null };
  }));
  assert.equal(calls, 0);
});
