import type { Metadata } from "next"
import { Geist_Mono, Roboto, Roboto_Slab } from "next/font/google"

import "./globals.css"
import { CartProvider } from "@/components/cart/cart-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ROOT_METADATA } from "@/lib/site/metadata"
import { cn } from "@/lib/utils"

const robotoSlabHeading = Roboto_Slab({
  subsets: ["latin"],
  variable: "--font-heading",
})

const roboto = Roboto({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = ROOT_METADATA

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        roboto.variable,
        robotoSlabHeading.variable
      )}
    >
      <body>
        <ThemeProvider>
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
