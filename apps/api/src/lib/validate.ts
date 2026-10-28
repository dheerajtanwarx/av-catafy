import { isValidObjectId } from "mongoose";
import type { z } from "zod";
import { AppError } from "./errors.js";

/** Parse with a Zod schema; failures become a 400 VALIDATION_ERROR via the error handler. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  return schema.parse(data);
}

export function assertObjectId(id: string | undefined, what = "Record"): string {
  if (!id || !isValidObjectId(id)) throw AppError.notFound(`${what} not found`);
  return id;
}
