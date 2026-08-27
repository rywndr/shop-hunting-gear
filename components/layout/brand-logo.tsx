import Image from "next/image"
import Link from "next/link"

import { SITE } from "@/lib/site-config"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  tone?: "dark" | "light"
}

function BrandLogo({ className, tone = "dark" }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:flex-col md:items-start md:gap-1",
        className
      )}
    >
      <Image
        src={SITE.logo.src}
        width={SITE.logo.width}
        height={SITE.logo.height}
        alt=""
        priority
        className={cn("h-9 w-auto md:h-14", tone === "dark" && "invert")}
      />
      <span className="font-heading text-sm leading-none font-bold tracking-tight whitespace-nowrap uppercase sm:text-base md:text-xl">
        {SITE.name}
      </span>
    </Link>
  )
}

export { BrandLogo }
