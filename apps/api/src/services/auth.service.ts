import type { LoginInput, SessionUser } from "@catafy/types";
import argon2 from "argon2";
import { AppError } from "../lib/errors.js";
import { User } from "../models/index.js";

// Verified against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function authenticate({ email, password }: LoginInput): Promise<SessionUser> {
  const user = await User.findOne({ email }).select("+passwordHash").lean();
  if (!user) {
    dummyHash ??= argon2.hash("not-a-real-password");
    await argon2.verify(await dummyHash, password);
    throw AppError.unauthorized("Incorrect email or password");
  }
  if (!(await argon2.verify(user.passwordHash, password))) {
    throw AppError.unauthorized("Incorrect email or password");
  }
  return { id: user._id.toString(), email: user.email };
}
