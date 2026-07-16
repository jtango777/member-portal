import { Cinzel } from 'next/font/google'

// Experimental wordmark font — used only for the standalone "BizHaus" logo text,
// not for body copy or other UI elements.
export const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
})
