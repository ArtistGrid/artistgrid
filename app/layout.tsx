import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster";
import './globals.css';

const siteConfig = {
  name: "ArtistGrid",
  url: "https://www.artistgrid.cx",
  ogImage: "https://www.artistgrid.cx/favicon.png",
  description: "Discover and track unreleased music from your favorite artists.",
  links: {
    github: "https://github.com/ArtistGrid",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "ArtistGrid | Unreleased Music",
    template: `%s | ArtistGrid`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "eduardprigoana", url: "https://prigoana.com" }],
  creator: "ArtistGrid Team",
  keywords: ["unreleased music", "music tracker", "leaks", "snippets", "artist tracker", "music discovery"],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [{
      url: siteConfig.ogImage,
      alt: `${siteConfig.name} - Unreleased Music`,
    }],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
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
      <body className="bg-black text-white min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}