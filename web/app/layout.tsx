import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./workspaces.css";
import "./admin.css";
import "./loading.css";
import { LoginTransitionProvider } from "@/components/login-transition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "VANBOOK PH", template: "%s | VANBOOK PH" },
  description: "Van rental and group transport in the Philippines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LoginTransitionProvider>{children}</LoginTransitionProvider>
      </body>
    </html>
  );
}
