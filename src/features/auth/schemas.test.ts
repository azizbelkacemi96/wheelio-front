import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./schemas";

describe("loginSchema", () => {
  it("accepts a valid email + non-empty password pair", () => {
    const result = loginSchema.safeParse({
      email: "owner@wheelio.dz",
      password: "s3cret!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "s3cret!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "owner@wheelio.dz",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validInput = {
    organization_name: "Wheelio Location Alger",
    email: "owner@wheelio.dz",
    password: "s3cret123",
    first_name: "Karim",
    last_name: "Haddad",
  };

  it("accepts a fully valid signup payload", () => {
    const result = signupSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("requires organization_name", () => {
    const result = signupSchema.safeParse({ ...validInput, organization_name: "" });
    expect(result.success).toBe(false);
  });

  it("requires a valid email", () => {
    const result = signupSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a 7-char password (below the 8-char backend minimum)", () => {
    const result = signupSchema.safeParse({ ...validInput, password: "abc1234" });
    expect(result.success).toBe(false);
  });

  it("requires first_name and last_name", () => {
    expect(signupSchema.safeParse({ ...validInput, first_name: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validInput, last_name: "" }).success).toBe(false);
  });
});
