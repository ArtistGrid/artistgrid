// app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster"; // Make sure this path is correct
import './globals.css';

// --- RICH METADATA OBJECT ---
const siteConfig = {
  name: "ArtistGrid",
  url: "https://www.artistgrid.cx", // Change to your actual domain
  ogImage: "https://www.artistgrid.cx/favicon.png", // URL to your open graph image
  description: "Unreleased Music",
  links: {
    github: "https://github.com/ArtistGrid",
  },
}

export const metadata: Metadata = {
  title: {
    default: "ArtistGrid | Unreleased Music",
    template: `%s | ArtistGrid`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "eduardprigoana", url: "https://prigoana.com" }, { name: "justAMZ" }],
  creator: "ArtistGrid Team",
  keywords: ["unreleased music", "music tracker", "leaks", "snippets", "artist tracker", "music discovery"],
  
  // --- Open Graph (for social media) ---
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        alt: `${siteConfig.name} - Unreleased Music`,
      },
    ],
  },
  
  // --- Favicons and Icons ---
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  
  // --- Other Important Tags ---
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* --- JSON-LD STRUCTURED DATA --- */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": siteConfig.name,
            "url": siteConfig.url,
            "potentialAction": {
              "@type": "SearchAction",
              "target": `${siteConfig.url}/?q={search_term_string}`,
              "query-input": "required name=search_term_string"
            }
          }) }}
        />
      </head>
      <body className="bg-black">
        {children}
      </body>
    </html>
  );
}