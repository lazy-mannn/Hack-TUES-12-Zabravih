import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HoneycombBackground from "@/app/hives/HoneycombBackground";
import ServiceWorkerRegistration from "@/app/components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://smeehive.zabravih.org"
  ),
  title: {
    default: "SmeeHive — Real-time Beehive Monitoring",
    template: "%s | SmeeHive",
  },
  description:
    "Monitor your beehives in real time. Track temperature, humidity, CO₂ levels and queen state from anywhere with SmeeHive.",
  authors: [{ name: "SmeeHive" }],
  creator: "SmeeHive",
  publisher: "SmeeHive",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SmeeHive",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SmeeHive",
    title: "SmeeHive — Real-time Beehive Monitoring",
    description:
      "Monitor your beehives in real time. Track temperature, humidity, CO₂ levels and queen state from anywhere.",
    images: [{ url: "/bee.svg", width: 512, height: 512, alt: "SmeeHive bee logo" }],
  },
  twitter: {
    card: "summary",
    title: "SmeeHive — Real-time Beehive Monitoring",
    description:
      "Monitor your beehives in real time. Track temperature, humidity, CO₂ levels and queen state from anywhere.",
    images: ["/bee.svg"],
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
      <body className="min-h-full flex flex-col">
        <HoneycombBackground />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
