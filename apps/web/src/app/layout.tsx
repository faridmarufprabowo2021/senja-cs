import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Senja CS — Customer Service WhatsApp untuk UMKM",
  description:
    "Inbox multi-agent, bot AI berbasis knowledge, dan handover ke manusia. Customer service WhatsApp yang rapi untuk UMKM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
