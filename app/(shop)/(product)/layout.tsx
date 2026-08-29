import { SiteShell } from "@/components/layout/site-shell"

export default function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <SiteShell variant="product">{children}</SiteShell>
}
