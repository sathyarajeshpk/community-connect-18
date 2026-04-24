import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100),
    email: z.string().trim().email("Invalid email").max(255),
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9\s-]{7,20}$/, "Invalid phone number"),
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
