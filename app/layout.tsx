import type { Metadata } from 'next'
import './globals.css'
import { archivo } from './fonts'

export const metadata: Metadata = {
  title: "kpick3 — NFL Pick'em Pool",
  description: "Pick 3 NFL games against the spread each week.",
  icons: {
    icon: [
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  )
}
