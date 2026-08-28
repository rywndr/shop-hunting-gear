import { HeroCarousel } from "@/components/layout/hero-carousel"
import { ProductGrid } from "@/components/products/product-grid"
import { ProductSection } from "@/components/products/product-section"
import { MOCK_PRODUCTS } from "@/lib/products/mock"

export default function Page() {
  return (
    <>
      <HeroCarousel />

      <ProductSection
        id="semua-produk"
        title="Semua Produk"
        description="Seluruh katalog dari empat kategori dalam satu daftar."
        className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12"
      >
        <ProductGrid
          products={MOCK_PRODUCTS}
          emptyMessage="Katalog sedang disiapkan. Hubungi kami untuk stok terbaru."
        />
      </ProductSection>
    </>
  )
}
