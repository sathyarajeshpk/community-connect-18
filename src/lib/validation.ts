import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100),
    email: z.string().trim().email("Invalid email").max(255),
    phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length === 10, "Phone number must be exactly 10 digits"),
    plotNumber: z.string().trim().min(1, "Plot number is required").max(30),
    password: z.string().min(8, "Min 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});
