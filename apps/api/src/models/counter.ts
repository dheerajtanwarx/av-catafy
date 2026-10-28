import { model, Schema, type InferSchemaType } from "mongoose";

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { strict: true, versionKey: false },
);

export type CounterDoc = InferSchemaType<typeof counterSchema>;
export const Counter = model("Counter", counterSchema);
