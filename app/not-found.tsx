import { NotFoundPanel } from "@/components/layout/not-found-panel"
import { SiteShell } from "@/components/layout/site-shell"

export default function NotFound() {
  return (
    <SiteShell variant="notFound">
      <NotFoundPanel
        title="Halaman tidak ditemukan"
        description="Alamat yang kamu buka sudah dipindahkan atau tidak pernah ada."
      />
    </SiteShell>
  )
}
