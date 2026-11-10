import { Router, type Request, type Response } from "express";
import type { pool } from "@workspace/db";
import { z } from "zod";
import { CreateClinicCaseBody, UpdateClinicCaseBody } from "@workspace/api-zod";

type Dependencies = {
  pool: Pick<typeof pool, "query" | "connect">;
  member: (authorization?: string) => Promise<string>;
  admin: (owner: string, authorization: string) => Promise<boolean>;
};
const columns = `id, owner_id AS "ownerId", topic_id AS "topicId", kind, subject, description,
  rating, status, operator_reply AS "operatorReply", revision, created_at AS "createdAt", updated_at AS "updatedAt"`;
const recordHistory = `INSERT INTO clinic_case_history(case_id,revision,status,operator_reply,actor_id)
  VALUES($1,$2,$3,$4,$5)`;
class ClinicError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createClinicRouter(deps: Dependencies) {
  const router = Router();
  const route = (action: (req: Request, res: Response, owner: string) => Promise<void>, adminOnly = false) =>
    async (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) throw new ClinicError(401, "Silakan masuk dengan akun PUB.");
        const owner = await deps.member(authorization);
        if (adminOnly && !await deps.admin(owner, authorization)) throw new ClinicError(403, "Akses operator hanya untuk admin PUB.");
        await action(req, res, owner);
      } catch (error) {
        const status = error instanceof ClinicError ? error.status :
          error && typeof error === "object" && "status" in error && Number.isInteger(error.status) ? Number(error.status) : 503;
        res.status(status >= 400 && status < 600 ? status : 503).json({
          error: error instanceof ClinicError ? error.message : status === 401
            ? "Sesi PUB tidak valid. Silakan masuk kembali."
            : "Layanan klinik belum dapat dihubungi. Data belum dapat diproses; silakan coba lagi.",
        });
      }
    };
  router.get("/cases", route(async (_req, res, owner) => {
    const { rows } = await deps.pool.query(`SELECT ${columns} FROM clinic_cases WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`, [owner]);
    res.json(rows);
  }));
  router.post("/cases", route(async (req, res, owner) => {
    const input = CreateClinicCaseBody.safeParse(req.body);
    if (!input.success || input.data.subject.trim().length < 3 || input.data.description.trim().length < 10) {
      throw new ClinicError(400, "Lengkapi loket, judul 3–180 karakter, dan ringkasan 10–4000 karakter.");
    }
    const value = input.data;
    const client = await deps.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`clinic:${owner}`]);
      const count = await client.query("SELECT count(*)::int AS count FROM clinic_cases WHERE owner_id=$1 AND created_at>now()-interval '24 hours'", [owner]);
      if (count.rows[0].count >= 20) throw new ClinicError(429, "Batas 20 permintaan klinik per 24 jam tercapai. Lanjutkan melalui permintaan yang sudah ada.");
      const { rows } = await client.query(`INSERT INTO clinic_cases(owner_id,topic_id,kind,subject,description,rating)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,
      [owner, value.topicId, value.kind, value.subject.trim(), value.description.trim(), value.rating ?? null]);
      await client.query(recordHistory, [rows[0].id, rows[0].revision, rows[0].status, rows[0].operatorReply, owner]);
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }));
  router.get("/cases/:id/history", route(async (req, res, owner) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw new ClinicError(400, "ID permintaan tidak valid.");
    const found = await deps.pool.query(`SELECT owner_id, ${columns} FROM clinic_cases WHERE id=$1`, [id.data]);
    if (!found.rows.length || (found.rows[0].owner_id !== owner && !await deps.admin(owner, req.headers.authorization!))) {
      throw new ClinicError(404, "Permintaan tidak ditemukan.");
    }
    const { rows } = await deps.pool.query(`SELECT id, case_id AS "caseId", revision, status,
      operator_reply AS "operatorReply", actor_id AS "actorId", created_at AS "createdAt"
      FROM clinic_case_history WHERE case_id=$1 ORDER BY revision ASC`, [id.data]);
    // A schema-only rollout cannot backfill production data. Expose the existing
    // snapshot until its first edit persists it, without inventing an author.
    const legacy = found.rows[0];
    res.json(rows.length ? rows : [{
      id: legacy.id, caseId: legacy.id, revision: legacy.revision, status: legacy.status,
      operatorReply: legacy.operatorReply, actorId: null, createdAt: legacy.updatedAt,
    }]);
  }));
  router.get("/operator/cases", route(async (_req, res) => {
    const { rows } = await deps.pool.query(`SELECT ${columns} FROM clinic_cases ORDER BY updated_at DESC LIMIT 200`);
    res.json(rows);
  }, true));
  router.patch("/operator/cases/:id", route(async (req, res, owner) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const input = UpdateClinicCaseBody.safeParse(req.body);
    if (!id.success || !input.success || (input.data.status === "answered" && !input.data.operatorReply.trim())) {
      throw new ClinicError(400, "Isi balasan sebelum menandai permintaan sudah dijawab.");
    }
    const client = await deps.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query(`SELECT ${columns} FROM clinic_cases WHERE id=$1 FOR UPDATE`, [id.data]);
      if (!previous.rows.length) throw new ClinicError(404, "Permintaan tidak ditemukan.");
      if (previous.rows[0].revision !== input.data.expectedRevision) {
        throw new ClinicError(409, "Permintaan sudah diubah operator lain. Muat versi terbaru; draf Anda tetap disimpan di editor.");
      }
      // Preserve pre-history data on first edit after a schema-only rollout.
      await client.query(`INSERT INTO clinic_case_history(case_id,revision,status,operator_reply,actor_id,created_at)
        SELECT id,revision,status,operator_reply,NULL,updated_at FROM clinic_cases WHERE id=$1
        ON CONFLICT (case_id,revision) DO NOTHING`, [id.data]);
      const { rows } = await client.query(`UPDATE clinic_cases SET status=$2,operator_reply=$3,revision=revision+1,updated_at=now()
        WHERE id=$1 AND revision=$4 RETURNING ${columns}`,
      [id.data, input.data.status, input.data.operatorReply.trim(), input.data.expectedRevision]);
      if (!rows.length) {
        const exists = await client.query("SELECT id FROM clinic_cases WHERE id=$1", [id.data]);
        if (!exists.rows.length) throw new ClinicError(404, "Permintaan tidak ditemukan.");
        throw new ClinicError(409, "Permintaan sudah diubah operator lain. Muat versi terbaru; draf Anda tetap disimpan di editor.");
      }
      const saved = rows[0];
      await client.query(recordHistory, [saved.id, saved.revision, saved.status, saved.operatorReply, owner]);
      await client.query("COMMIT");
      res.json(saved);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }, true));
  return router;
}
