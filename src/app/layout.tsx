
import "./globals.css";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { ClientLayoutWrapper } from "@/components/ClientLayoutWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AxisThemeProvider } from "@/components/AxisThemeProvider";

export const metadata = {
  title: "InternFlow · Intern Portal",
  description: "InternFlow intern management platform — track projects, give feedback, and manage internship cohorts across AI and Business divisions.",
  icons: {
    icon: "/logo.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading request headers opts the root layout into dynamic rendering, which
  // lets Next.js attach the request-specific CSP nonce to its startup scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" nonce={nonce} suppressHydrationWarning>
      <body>
        <ThemeProvider nonce={nonce}>
          <AxisThemeProvider>
            <Suspense fallback={null}>
              <ClientLayoutWrapper>
                {children}
              </ClientLayoutWrapper>
            </Suspense>
          </AxisThemeProvider>
          <Toaster position="bottom-right" richColors closeButton theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
