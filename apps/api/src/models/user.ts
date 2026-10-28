import { model, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner"], default: "owner", required: true },
  },
  { timestamps: true, strict: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
