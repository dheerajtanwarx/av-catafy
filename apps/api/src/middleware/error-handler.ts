import type { ErrorEnvelope } from "@catafy/types";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};

function isDuplicateKeyError(err: unknown): err is { code: 11000; keyValue?: unknown } {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

/** body-parser errors carry an HTTP status and a `type` such as "entity.too.large". */
function isHttpError(err: unknown): err is { status: number; type?: string; message: string } {
  return (
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
  );
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Invalid request", err.flatten());
  }
  if (isDuplicateKeyError(err)) {
    return AppError.conflict("A record with this value already exists", err.keyValue);
  }
  if (isHttpError(err) && err.status >= 400 && err.status < 500) {
    const message =
      err.type === "entity.too.large" ? "Request body too large" : "Malformed request";
    return new AppError(err.status, "BAD_REQUEST", message);
  }
  return new AppError(500, "INTERNAL_ERROR", "Something went wrong");
}

export function createErrorHandler(exposeStack: boolean): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const appError = toAppError(err);
    if (appError.status >= 500) req.log.error({ err }, "Unhandled error");

    const body: ErrorEnvelope & { error: { stack?: string } } = {
      error: { code: appError.code, message: appError.message },
    };
    if (appError.details !== undefined) body.error.details = appError.details;
    if (exposeStack && err instanceof Error) body.error.stack = err.stack;

    res.status(appError.status).json(body);
  };
}
