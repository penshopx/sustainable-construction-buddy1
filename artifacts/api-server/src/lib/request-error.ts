import type { ErrorRequestHandler } from "express";

export const handleRequestError: ErrorRequestHandler = (error, req, res, _next) => {
  const type = error && typeof error === "object" ? error.type : undefined;
  const status = type === "entity.too.large" ? 413
    : type === "entity.parse.failed" || error instanceof URIError ? 400 : 500;
  req.log?.warn({ status }, "Request could not be processed");
  res.status(status).json({
    error: status === 413 ? "Ukuran permintaan terlalu besar."
      : status === 400 ? "Format permintaan tidak valid." : "Layanan sedang mengalami gangguan.",
  });
};
