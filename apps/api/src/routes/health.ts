import { Router } from "express";
import mongoose from "mongoose";
import { isDbConnected } from "../db.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db: "up" | "down" = "down";
  if (isDbConnected()) {
    try {
      await mongoose.connection.db?.admin().ping();
      db = "up";
    } catch {
      db = "down";
    }
  }
  res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db });
});
