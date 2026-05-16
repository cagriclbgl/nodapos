import { AuthProvider } from "@/lib/auth-context";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
