import { z } from "zod";

export const SESSION_COOKIE = "catafy_session";

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export interface SessionUser {
  id: string;
  email: string;
}
