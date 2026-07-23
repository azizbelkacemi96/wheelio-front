/**
 * Zod validation schemas for the login and signup forms.
 *
 * Field names and constraints mirror wheelio-api's `loginRequest`/
 * `signupRequest` DTOs exactly (per 01-05-PLAN.md's own read_first: json
 * tags `email`, `password` for login; `organization_name`, `email`,
 * `password`, `first_name`, `last_name` for signup — password min length 8
 * to match the backend's own validation, per 01-RESEARCH.md Security Domain
 * V5 Input Validation). Client-side validation here is a UX nicety only —
 * wheelio-api's `bindAndValidate` re-validates independently server-side.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  organization_name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
