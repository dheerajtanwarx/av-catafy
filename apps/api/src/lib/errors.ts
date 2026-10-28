import type { ErrorCode } from "@catafy/types";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, "CONFLICT", message, details);
  }
}
