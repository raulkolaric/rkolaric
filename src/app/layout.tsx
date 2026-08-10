import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Raul Kolarić",
  description:
    "Full Stack Developer and Computer Science student at PUC-SP in São Paulo, Brazil.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={jetbrainsMono.variable}
    >
      <body>{children}</body>
    </html>
  );
}
