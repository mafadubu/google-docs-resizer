import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Google Docs Image Resizer",
  description: "Perfectly resize images in your Google Docs with one click.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
