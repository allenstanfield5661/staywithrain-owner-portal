import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { League_Spartan, Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  variable: "--font-league-spartan",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Stay with Rain · Owner Portal",
    template: "%s · Stay with Rain",
  },
  description: "Private booking calendars for Stay with Rain owners on the Mississippi Gulf Coast.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12384F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${leagueSpartan.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
