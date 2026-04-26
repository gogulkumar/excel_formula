import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "@/app/globals.css";
import { NavProgress } from "@/components/nav-progress";
import { ProductTour } from "@/components/product-tour";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CalcSense",
  description: "CalcSense — AI reads every formula, follows every reference, and explains workbook logic in plain English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
        <Suspense>
          <NavProgress />
        </Suspense>
        {children}
        <ProductTour />
      </body>
    </html>
  );
}
