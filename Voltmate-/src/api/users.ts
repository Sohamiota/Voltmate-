import { post } from "./client";

export async function login(email: string, password: string) {
  return post("/auth/login", { email, password });
}

export async function getProfile(token: string) {
  return post("/auth/me", {}, token);
}

