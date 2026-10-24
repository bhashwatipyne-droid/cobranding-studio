import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheFinPedia · Cobranding Studio",
  description: "Co-brand approved TheFinPedia content with your own logo, colours and details.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&family=Poppins:wght@400;600;700&family=Playfair+Display:wght@600;700&family=Roboto:wght@400;500;700&family=Merriweather:wght@400;700&family=Lato:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
