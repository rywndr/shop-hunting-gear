import { SiteShell } from "@/components/layout/site-shell"

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <SiteShell variant="account">{children}</SiteShell>
}
