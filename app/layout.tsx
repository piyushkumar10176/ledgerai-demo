import type { Metadata } from "next";
import { Hanken_Grotesk, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LedgerAI UK — MTD demo",
  description: "AI-assisted MTD filing for UK accounting practices.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
