import { Archivo } from 'next/font/google'

export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-archivo',
})
