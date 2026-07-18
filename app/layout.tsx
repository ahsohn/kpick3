import type { Metadata } from 'next'
import './globals.css'
import { archivo } from './fonts'

export const metadata: Metadata = {
  title: "kpick3 — NFL Pick'em Pool",
  description: "Pick 3 NFL games against the spread each week.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  )
}
