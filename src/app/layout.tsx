import type { Metadata, Viewport } from "next";
import { MetaflowShell } from "./components/metaflow-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metaflow",
  description: "Low-code workflow engine",
  icons: {
    icon: "/triangle.svg",
    shortcut: "/triangle.svg",
    apple: "/triangle.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Platform",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased h-screen">
        <MetaflowShell>{children}</MetaflowShell>
      </body>
    </html>
  );
}
