import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TrackerHub Artist Grid',
  description: 'Unreleased Music',
  icons: {
    icon: './favicon.png',
    // or add more sizes/formats if you want
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Optionally add favicon manually here if you want */}
        {/* <link rel="icon" href="/favicon.ico" /> */}
      </head>
      <body>{children}</body>
    </html>
  )
}
