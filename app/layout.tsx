// Ensure server-safe localStorage so any library call during SSR doesn't crash.
const serverStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  key: (_index: number) => null,
  length: 0,
};

if (typeof window === "undefined") {
  try {
    // @ts-expect-error - deleting built-in localStorage
    delete globalThis.localStorage;
  } catch {

  }

  try {
    globalThis.localStorage = serverStorage;
  } catch {
    Object.defineProperty(globalThis, "localStorage", {
      value: serverStorage,
      configurable: true,
      writable: true,
    });
  }
}

import localFont from "next/font/local";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Omnilore",
  description: "Omnilore Database User Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <main>{children}</main>
        <Toaster
          position="bottom-left"
          richColors
          duration={10000}
          toastOptions={{
            closeButton: true,
          }}
        />
      </body>
    </html>
  );
}
