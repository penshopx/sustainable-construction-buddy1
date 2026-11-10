import assert from "node:assert/strict";

// Cheap preflight through real Auth and the real HTTP router, before a browser
// is started. Also usable when a native browser cannot launch on a workstation.
export async function checkBedahBackend(fixture) {
  const sessions = {};
  for (const [role, account] of Object.entries(fixture.accounts)) {
    const response = await fetch(`${fixture.authUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: fixture.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    assert.equal(response.status, 200, `Real ${role} password login failed`);
    const session = await response.json();
    assert.equal(session.user.id, account.id);
    sessions[role] = session.access_token;
  }
  const call = (role, endpoint, method = "GET", data, raw = false) => fetch(`${fixture.apiUrl}/api/ruang-simpan${endpoint}`, {
    method, headers: {
      Authorization: `Bearer ${sessions[role]}`,
      "Content-Type": raw ? "application/octet-stream" : "application/json",
      ...(fixture.origin ? { Origin: fixture.origin } : {}),
    },
    ...(data !== undefined ? { body: raw ? data : JSON.stringify(data) } : {}),
  });
  const success = async (response, step) => {
    const payload = await response.json();
    assert.equal(response.status, 200, `${step}: HTTP ${response.status}; ${payload.error || ""}`);
    return payload;
  };
  const source = "Kontrak sintetis privat.\nMasa pelaksanaan 90 hari.";
  const doc = await success(await call("owner", "/documents?name=backend-private.txt&folderId=default-6", "POST", source, true), "Real upload");
  assert.equal(doc.text, source);
  assert.equal(doc.objectPath, undefined);
  const session = await call("owner", "/session", "POST");
  assert.equal(session.status, 200);
  const cookie = session.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "PUB session cookie missing");
  const cookieRequest = await fetch(`${fixture.apiUrl}/api/ruang-simpan/workspace`, { headers: { Cookie: cookie } });
  assert.equal((await success(cookieRequest, "Real cookie session")).documents[0].id, doc.id);
  const override = await fetch(`${fixture.apiUrl}/api/ruang-simpan/workspace`, {
    headers: { Cookie: cookie, Authorization: `Bearer ${sessions.stranger}` },
  });
  assert.deepEqual((await success(override, "Bearer takes precedence over another owner's cookie")).documents, []);
  const badOrigin = await fetch(`${fixture.apiUrl}/api/ruang-simpan/documents/${doc.id}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${sessions.owner}`, Origin: "https://not-this-app.invalid" },
  });
  assert.equal(badOrigin.status, 403);
  const analysis = await success(await call("owner", "/bedah-dokumen", "POST", { documentId: doc.id, consent: true }), "Real analysis persistence");
  assert.match(analysis.result.summary, /BEDAH-PRIVATE-SUMMARY/);
  const chat = await success(await call("owner", `/bedah-dokumen/${analysis.id}/chat`, "POST", { question: "Berapa masa pelaksanaan?", consent: true }), "Real chat persistence");
  assert.deepEqual(chat.messages.map(m => m.role), ["user", "assistant"]);
  const gate = async command => {
    assert.equal((await fetch(`${fixture.controlUrl || fixture.apiUrl}/__test/${command}`, { method: "POST" })).status, 204);
  };
  // Actual overlapping HTTP sessions, not a fake owner string. Verify the
  // provider received the owner request before observing the new account.
  await gate("gate");
  const lateChat = call("owner", `/bedah-dokumen/${analysis.id}/chat`, "POST", { question: "Pertanyaan owner tertunda", consent: true });
  try {
    let started = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const status = await (await fetch(`${fixture.controlUrl || fixture.apiUrl}/__test/gate`)).json();
      if (status.started) { started = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(started, "Provider did not receive pending owner chat");
    for (const role of ["stranger", "admin"]) {
      assert.deepEqual(await success(await call(role, "/bedah-dokumen"), `In-flight ${role} list`), []);
    }
  } finally { await gate("release"); }
  const lateResult = await success(await lateChat, "Late owner chat");
  assert.equal(lateResult.messages.length, 4);
  for (const role of ["stranger", "admin"]) {
    assert.deepEqual(await success(await call(role, "/bedah-dokumen"), `${role} list`), []);
    for (const [method, route, data] of [
      ["GET", `/documents/${doc.id}/download`],
      ["POST", "/bedah-dokumen", { documentId: doc.id, consent: true }],
      ["POST", `/bedah-dokumen/${analysis.id}/chat`, { question: "Akses asing", consent: true }],
      ["DELETE", `/bedah-dokumen/${analysis.id}`],
      ["DELETE", `/documents/${doc.id}`],
    ]) {
      assert.equal((await call(role, route, method, data)).status, 404, `${role} ${method} ${route}`);
    }
  }
  const reloaded = await success(await call("owner", "/bedah-dokumen"), "Reload persisted analysis");
  assert.equal(reloaded[0].messages.length, 4);
  assert.equal((await call("owner", `/documents/${doc.id}`, "DELETE")).status, 204);
  assert.deepEqual(await success(await call("owner", "/bedah-dokumen"), "Deleted source list"), []);
  assert.equal((await call("owner", `/bedah-dokumen/${analysis.id}/chat`, "POST", { question: "Sumber dihapus", consent: true })).status, 404);
  const { rows } = await fixture.pool.query("SELECT state FROM rs_workspaces WHERE owner_id=$1", [fixture.accounts.owner.id]);
  assert.equal(rows[0].state.documentAnalyses.length, 0);
  assert.equal(rows[0].state.documents.length, 0);
  // This database belongs solely to this run; reset before browser controls.
  await fixture.pool.query("DELETE FROM rs_workspaces");
}
