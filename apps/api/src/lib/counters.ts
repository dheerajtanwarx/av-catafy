import type { ClientSession } from "mongoose";
import { Counter } from "../models/counter.js";

/** Atomically increments and returns the next value of a named sequence. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  ).lean();
  if (!counter) throw new Error(`Counter "${name}" could not be incremented`);
  return counter.seq;
}

export function formatOrderNumber(year: number, seq: number): string {
  return `ORD-${year}-${String(seq).padStart(5, "0")}`;
}

/** Order numbers restart every calendar year, e.g. ORD-2026-00042. */
export async function nextOrderNumber(
  session?: ClientSession,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const seq = await nextSequence(`order-${year}`, session);
  return formatOrderNumber(year, seq);
}
