import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://google-docs-resizer.vercel.app"),
  title: "Google Docs Image Resizer ✨",
  description: "Perfectly resize images in your Google Docs with one click. Simple, fast, and secure.",
  openGraph: {
    title: "Google Docs Image Resizer",
    description: "Perfectly resize images in your Google Docs with one click.",
    url: "https://google-docs-resizer.vercel.app",
    siteName: "Google Docs Image Resizer",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Google Docs Image Resizer Preview",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Google Docs Image Resizer",
    description: "Perfectly resize images in your Google Docs with one click.",
    images: ["/og-image.png"],
  },
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
