// API_BASE_URL points at the .NET backend. Override per-environment via
// NEXT_PUBLIC_API_BASE_URL — Vercel project settings should set this to the
// Render backend URL (e.g. https://pizzapos-api.onrender.com).
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
