import { SiteShell } from "@/components/layout/site-shell"

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <SiteShell variant="shop">{children}</SiteShell>
}
