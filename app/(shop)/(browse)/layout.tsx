import { SiteShell } from "@/components/layout/site-shell"

export default function BrowseLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <SiteShell variant="browse">{children}</SiteShell>
}
