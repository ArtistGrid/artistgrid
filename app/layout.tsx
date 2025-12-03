// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

import { PlayerProvider } from "./providers";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";

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
  keywords: ["unreleased music tracker","music tracker","leaks tracker","snippets tracker","artist tracker","music discovery tracker","new music tracker","exclusive tracks tracker","soundtrack tracker","beats tracker","songs tracker","remixes tracker","playlists tracker","albums tracker","EPs tracker","singles tracker","tracklist tracker","streaming tracker","charts tracker","hot tracks tracker","music news tracker","pop tracker","hip hop tracker","rap tracker","Rihanna tracker","Drake tracker","Taylor Swift tracker","Beyoncé tracker","Kanye West tracker","Billie Eilish tracker","The Weeknd tracker","Travis Scott tracker","Adele tracker","Kendrick Lamar tracker","Doja Cat tracker","Ed Sheeran tracker","Ariana Grande tracker","Post Malone tracker","SZA tracker","Olivia Rodrigo tracker","Lil Nas X tracker","J. Cole tracker","Harry Styles tracker","Justin Bieber tracker","Lizzo tracker","Bad Bunny tracker","Shawn Mendes tracker","Megan Thee Stallion tracker","BLACKPINK tracker","BTS tracker","Dua Lipa tracker","Selena Gomez tracker","Cardi B tracker","Nicki Minaj tracker","Imagine Dragons tracker","Coldplay tracker","Billboard tracker","soundcloud tracker","spotify tracker","apple music tracker","Tidal tracker","music leaks tracker","exclusive music tracker","upcoming releases tracker","hot singles tracker","viral songs tracker","underground music tracker","trap music tracker","EDM tracker","dance music tracker","indie tracker","rock music tracker","alternative music tracker","R&B tracker","soul music tracker","jazz tracker","lofi tracker","chill music tracker","acoustic tracker","country music tracker","reggae tracker","K-pop tracker","Latin music tracker","Afrobeats tracker","emo rap tracker","drill music tracker","grime music tracker","punk tracker","metal music tracker","classic rock tracker","instrumental tracker","sound design tracker","studio tracker","music production tracker","sample tracker","DJ tracker","mixtape tracker","album tracker","song drops tracker","live performance tracker","tour tracker","festival tracker","music video tracker","official releases tracker","rare tracks tracker","bonus tracks tracker","deleted tracks tracker","vault music tracker","archive music tracker","lost music tracker","undiscovered music tracker","hidden tracks tracker","demo tracker","side project tracker","fan release tracker","exclusive drop tracker","collaboration tracker","soundcloud leak tracker","spotify leak tracker","apple music leak tracker","Tidal leak tracker","pop unreleased tracker","rap unreleased tracker","hip hop unreleased tracker","R&B unreleased tracker","EDM unreleased tracker","rock unreleased tracker","indie unreleased tracker","K-pop unreleased tracker","Latin unreleased tracker","Afrobeats unreleased tracker","trap unreleased tracker","drill unreleased tracker","jazz unreleased tracker","lofi unreleased tracker","chill unreleased tracker","acoustic unreleased tracker","country unreleased tracker","reggae unreleased tracker","alternative unreleased tracker","soul unreleased tracker","metal unreleased tracker","punk unreleased tracker","classical unreleased tracker","instrumentals unreleased tracker","remixes unreleased tracker","mixtapes unreleased tracker","EPs unreleased tracker","singles unreleased tracker","albums unreleased tracker","live unreleased tracker","studio unreleased tracker","samples unreleased tracker","DJ unreleased tracker","collaborations unreleased tracker","demos unreleased tracker","side projects unreleased tracker","trackerhub","niche tracker","UG tracker","unreleased music","music","leaks","snippets","artist","music discovery","new music","exclusive tracks","soundtrack","beats","songs","remixes","playlists","albums","EPs","singles","tracklist","streaming","charts","hot tracks","music news","pop","hip hop","rap","Rihanna","Drake","Taylor Swift","Beyoncé","Kanye West","Billie Eilish","The Weeknd","Travis Scott","Adele","Kendrick Lamar","Doja Cat","Ed Sheeran","Ariana Grande","Post Malone","SZA","Olivia Rodrigo","Lil Nas X","J. Cole","Harry Styles","Justin Bieber","Lizzo","Bad Bunny","Shawn Mendes","Megan Thee Stallion","BLACKPINK","BTS","Dua Lipa","Selena Gomez","Cardi B","Nicki Minaj","Imagine Dragons","Coldplay","Billboard","soundcloud","spotify","apple music","Tidal","music leaks","exclusive music","upcoming releases","hot singles","viral songs","underground music","trap music","EDM","dance music","indie","rock music","alternative music","R&B","soul music","jazz","lofi","chill music","acoustic","country music","reggae","K-pop","Latin music","Afrobeats","emo rap","drill music","grime music","punk","metal music","classic rock","instrumental","sound design","studio","music production","sample","DJ","mixtape","album","song drops","live performance","tour","festival","music video","official releases","rare tracks","bonus tracks","deleted tracks","vault music","archive music","lost music","undiscovered music","hidden tracks","demo","side project","fan release","exclusive drop","collaboration","soundcloud leak","spotify leak","apple music leak","Tidal leak","pop unreleased","rap unreleased","hip hop unreleased","R&B unreleased","EDM unreleased","rock unreleased","indie unreleased","K-pop unreleased","Latin unreleased","Afrobeats unreleased","trap unreleased","drill unreleased","jazz unreleased","lofi unreleased","chill unreleased","acoustic unreleased","country unreleased","reggae unreleased","alternative unreleased","soul unreleased","metal unreleased","punk unreleased","classical unreleased","instrumentals unreleased","remixes unreleased","mixtapes unreleased","EPs unreleased","singles unreleased","albums unreleased","live unreleased","studio unreleased","samples unreleased","DJ unreleased","collaborations unreleased","demos unreleased","side projects unreleased","trackerhub","niche","UG"],
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
    images: [
      {
        url: siteConfig.ogImage,
        alt: `${siteConfig.name} - Unreleased Music`,
      },
    ],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url,
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteConfig.url}/?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        {/* Plausible Analytics */}
        <Script
          defer
          data-domain="artistgrid.cx"
          src="https://plausible.canine.tools/js/script.file-downloads.hash.outbound-links.pageview-props.revenue.tagged-events.js"
          strategy="afterInteractive"
        />

        <Script id="plausible-inline" strategy="afterInteractive">
          {`
            window.plausible = window.plausible || function() {
              (window.plausible.q = window.plausible.q || []).push(arguments)
            }
          `}
        </Script>
      </head>

      <body className="bg-black text-white min-h-screen">
        <PlayerProvider>
          {children}
          <GlobalPlayer />
          <Toaster />
        </PlayerProvider>
      </body>
    </html>
  );
}



