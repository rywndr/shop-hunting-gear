import Image from "next/image"
import Link from "next/link"

import { SITE } from "@/lib/site/config"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  tone?: "dark" | "light"
  layout?: "lockup" | "inline"
}

function BrandLogo({
  className,
  tone = "dark",
  layout = "lockup",
}: BrandLogoProps) {
  const isLockup = layout === "lockup"

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        isLockup && "md:flex-col md:items-start md:gap-1",
        className
      )}
    >
      <Image
        src={SITE.logo.src}
        width={SITE.logo.width}
        height={SITE.logo.height}
        alt=""
        priority
        className={cn(
          "h-9 w-auto",
          isLockup && "md:h-14",
          tone === "dark" && "invert"
        )}
      />
      <span
        className={cn(
          "font-heading text-sm leading-none font-bold tracking-tight whitespace-nowrap uppercase sm:text-base",
          isLockup && "md:text-xl"
        )}
      >
        {SITE.name}
      </span>
    </Link>
  )
}

export { BrandLogo }
