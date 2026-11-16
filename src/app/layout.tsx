import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Russian Writing Quest",
  description:
    "Your ideas, in your own words. An original Russian writing practice journey for heritage-language learners.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
