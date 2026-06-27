import { apiFetch } from "./http.js";

export async function getMe() {
  const response = await apiFetch("/auth/me");
  return response.user;
}

export async function login(email, password) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return response.user;
}

export async function signup(email, password) {
  const response = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return response.user;
}

export async function logout() {
  return apiFetch("/auth/logout", { method: "POST" });
}
