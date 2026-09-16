import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LinkFi | Sales & Performance Reports",
    template: "%s | LinkFi Reports",
  },
  description:
    "Financial overview, daily collection summaries, and camp-wise revenue analytics for hotspot networks.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "LinkFi | Sales & Performance Reports",
    description:
      "Financial overview, daily collection summaries, and camp-wise revenue analytics for hotspot networks.",
    siteName: "LinkFi Reports",
    images: [
      {
        url: "/og-image.png",
        width: 1670,
        height: 941,
        alt: "LinkFi Sales & Performance Reports",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkFi | Sales & Performance Reports",
    description:
      "Financial overview, daily collection summaries, and camp-wise revenue analytics for hotspot networks.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
