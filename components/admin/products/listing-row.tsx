"use client"

import { Fragment, useId, useState } from "react"
import Link from "next/link"
import { CaretDownIcon, EyeIcon } from "@phosphor-icons/react"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { CopyIdButton } from "@/components/admin/copy-id-button"
import { ListingActions } from "@/components/admin/products/listing-actions"
import { ListingQuickEdit } from "@/components/admin/products/listing-quick-edit"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  listingVariantNames,
  LISTING_STATES,
  type Listing,
} from "@/lib/admin/catalog"
import { productDiscount, productHref } from "@/lib/products/config"
import { cn } from "@/lib/utils"
import {
  formatNumber,
  formatRupiah,
  formatUpdateTime,
} from "@/utils/format/intl"

function ListingRow({
  listing,
  columnCount,
  now,
  selected,
  onSelectedChange,
}: {
  listing: Listing
  columnCount: number
  now: string
  selected: boolean
  onSelectedChange: (selected: boolean) => void
}) {
  const { id, product } = listing
  const { editable } = LISTING_STATES[listing.state]
  const [expanded, setExpanded] = useState(false)
  const variantsId = useId()
  const variantNames = listingVariantNames(listing)
  const discount = productDiscount(product)

  return (
    <Fragment>
      <TableRow
        data-state={selected ? "selected" : undefined}
        className="group/row"
      >
        <TableCell className={cn(TABLE_EDGE, "align-top")}>
          <Checkbox
            aria-label={`Pilih ${product.name}`}
            checked={selected}
            onCheckedChange={(next) => onSelectedChange(next)}
          />
        </TableCell>

        <TableCell
          className={cn(TABLE_EDGE, "max-w-72 align-top whitespace-normal")}
        >
          <div className="flex items-start gap-3">
            <ProductThumbnail
              src={product.images[0].url}
              label={product.images[0].alt}
              className="size-11 shrink-0"
              iconClassName="size-5"
            />

            <div className="min-w-0 space-y-1">
              <div className="flex items-start gap-1">
                <p className="line-clamp-2 font-medium">{product.name}</p>
                <Link
                  href={productHref(product)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Lihat ${product.name} di tab baru`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-xs" }),
                    "shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                  )}
                >
                  <EyeIcon />
                </Link>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <span className="max-w-[12ch] min-w-0 truncate sm:max-w-none">
                  ID {id}
                </span>
                <CopyIdButton value={id} label={`ID ${id}`} />
              </div>

              <div className="flex items-center gap-1 text-xs font-medium tabular-nums md:hidden">
                <span>
                  {formatRupiah(product.price)}
                  {discount && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Badge
                        variant="destructive"
                        className="font-bold tabular-nums"
                      >
                        {discount.percent}%
                      </Badge>
                      <s className="text-destructive/70">
                        {formatRupiah(discount.compareAtPrice)}
                      </s>
                    </span>
                  )}
                </span>
                {editable && (
                  <ListingQuickEdit
                    productId={listing.id}
                    field="price"
                    label="Harga jual"
                    value={product.price}
                    compareAtPrice={product.compareAtPrice}
                    prefix="Rp"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:hidden">
                <span className="text-xs text-muted-foreground">
                  {formatUpdateTime(listing.updatedAt, now)}
                </span>
              </div>
            </div>
          </div>
        </TableCell>

        <TableCell
          className={cn(
            TABLE_EDGE,
            "hidden align-top text-xs text-muted-foreground lg:table-cell"
          )}
        >
          {formatUpdateTime(listing.updatedAt, now)}
        </TableCell>

        <TableCell
          className={cn(
            TABLE_EDGE,
            "hidden text-right align-top tabular-nums md:table-cell"
          )}
        >
          <div className="flex items-center justify-end gap-1">
            <span>
              {formatRupiah(product.price)}
              {discount && (
                <span className="flex items-center justify-end gap-1 text-xs">
                  <Badge
                    variant="destructive"
                    className="font-bold tabular-nums"
                  >
                    {discount.percent}%
                  </Badge>
                  <s className="text-destructive/70">
                    {formatRupiah(discount.compareAtPrice)}
                  </s>
                </span>
              )}
            </span>
            {editable && (
              <ListingQuickEdit
                productId={listing.id}
                field="price"
                label="Harga jual"
                value={product.price}
                compareAtPrice={product.compareAtPrice}
                prefix="Rp"
              />
            )}
          </div>
        </TableCell>

        <TableCell className={cn(TABLE_EDGE, "text-right align-top")}>
          <div className="flex items-center justify-end gap-1">
            {product.stock === 0 ? (
              <span className="text-destructive">Habis</span>
            ) : (
              <span className="tabular-nums">
                {formatNumber(product.stock)}
              </span>
            )}
            {editable && (
              <ListingQuickEdit
                productId={listing.id}
                field="stock"
                label="Stok"
                value={product.stock}
              />
            )}
          </div>
        </TableCell>

        <TableCell className={cn(TABLE_EDGE, "text-right align-top")}>
          <ListingActions listing={listing} />
        </TableCell>
      </TableRow>

      {variantNames.length > 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columnCount} className="p-0 whitespace-normal">
            <div className="flex items-center justify-between border-b px-(--card-spacing) py-2 text-xs">
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(variantNames.length)} SKU
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                aria-controls={variantsId}
              >
                {expanded ? "Tutup" : "Buka"}
                <CaretDownIcon
                  data-icon="inline-end"
                  className={cn(
                    "transition-transform",
                    expanded && "rotate-180"
                  )}
                  aria-hidden
                />
              </Button>
            </div>

            {expanded && (
              <div id={variantsId} className="divide-y bg-muted/20">
                {variantNames.map((variant) => (
                  <div
                    key={variant}
                    className="grid gap-2 px-(--card-spacing) py-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_minmax(10rem,16rem)] sm:items-center sm:gap-4"
                  >
                    <span className="min-w-0 text-sm">{variant}</span>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={product.stock}
                      readOnly={!editable}
                      aria-label={`Stok ${variant}`}
                      className="tabular-nums"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={product.price}
                        readOnly={!editable}
                        aria-label={`Harga ${variant}`}
                        className="pl-8 tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

export { ListingRow }
