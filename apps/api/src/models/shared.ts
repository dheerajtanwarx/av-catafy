import { Schema } from "mongoose";

/** An image stored in R2. `key` is the object key; the public URL is R2_PUBLIC_BASE_URL + key. */
export const imageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

/** Integer paise; rejects fractional values so floats never sneak in. */
export const paise = {
  type: Number,
  min: 0,
  validate: { validator: Number.isInteger, message: "Amount must be an integer number of paise" },
} as const;
