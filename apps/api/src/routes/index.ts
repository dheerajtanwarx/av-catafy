import { Router } from "express";
import { healthRouter } from "./health.js";

export const v1Router = Router();

v1Router.use("/health", healthRouter);
// Storefront endpoints (no auth) and owner endpoints (auth) arrive in later phases.
v1Router.use("/public", Router());
v1Router.use("/admin", Router());
