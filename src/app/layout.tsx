import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import StoreProvider from "@/components/StoreProvider";
import BackgroundSync from "@/components/BackgroundSync";
import Header from "@/components/Header";
import ToastProvider from "@/components/ToastProvider";
import { EtaDataProvider } from "@/components/EtaDataProvider";
import { DEFAULT_PALETTE_ID, themeInitScript } from "@/lib/themePalettes";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "ETA Control",
  description: "Heizungssteuerung und Wetterdaten",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" data-mode="dark" data-palette={DEFAULT_PALETTE_ID} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StoreProvider>
          <EtaDataProvider>
            <ToastProvider>
              <BackgroundSync />
              <Header />
              <main className="app-main">{children}</main>
            </ToastProvider>
          </EtaDataProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
