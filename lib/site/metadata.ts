import type { Metadata } from "next"

import { SITE } from "./config"

/**
 * Next.js replaces nested metadata fields instead of merging them, so any page
 * that sets `openGraph`, `twitter`, `robots`, or `alternates` must supply the
 * whole object. `pageMetadata` builds all four from `SITE`.
 */

const TITLE_SEPARATOR = " | "

const MAX_DESCRIPTION = 160

function clampDescription(value: string) {
  const text = value.replace(/\s+/g, " ").trim()

  if (text.length <= MAX_DESCRIPTION) {
    return text
  }

  const cut = text.slice(0, MAX_DESCRIPTION - 1)
  const lastSpace = cut.lastIndexOf(" ")
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut

  return `${trimmed.replace(/[.,;:·—]$/, "")}…`
}

const TITLE_TEMPLATE = `%s${TITLE_SEPARATOR}${SITE.alternateName}`

const DEFAULT_TITLE = `${SITE.tagline}${TITLE_SEPARATOR}${SITE.alternateName}`

function brandedTitle(title: string) {
  return `${title}${TITLE_SEPARATOR}${SITE.alternateName}`
}

export function areaTitle(area: string) {
  return {
    default: brandedTitle(area),
    template: `%s · ${area}${TITLE_SEPARATOR}${SITE.alternateName}`,
  } as const satisfies Metadata["title"]
}

type OpenGraphImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>

type SocialImage = Extract<OpenGraphImages, { url: unknown }>

const FALLBACK_IMAGE = {
  url: SITE.socialImage.src,
  width: SITE.socialImage.width,
  height: SITE.socialImage.height,
  alt: SITE.socialImage.alt,
} satisfies SocialImage

export const PRIVATE_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const satisfies Metadata["robots"]

const UNINDEXED_ROBOTS = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
} as const satisfies Metadata["robots"]

const PUBLIC_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
} as const satisfies Metadata["robots"]

type PageMetadataInput = {
  readonly title: string
  readonly description: string
  readonly path: string
  readonly images?: readonly SocialImage[]
  readonly index?: boolean
}

export function pageMetadata({
  title,
  description,
  path,
  images,
  index = true,
}: PageMetadataInput): Metadata {
  const socialImages = [...(images?.length ? images : [FALLBACK_IMAGE])]
  const socialTitle = brandedTitle(title)
  const snippet = clampDescription(description)

  return {
    title,
    description: snippet,
    alternates: { canonical: path },
    robots: index ? PUBLIC_ROBOTS : UNINDEXED_ROBOTS,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: SITE.locale,
      url: path,
      title: socialTitle,
      description: snippet,
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: snippet,
      images: socialImages,
    },
  }
}

export const ROOT_METADATA = {
  metadataBase: new URL(SITE.url),
  title: { default: DEFAULT_TITLE, template: TITLE_TEMPLATE },
  description: SITE.description,
  keywords: [...SITE.keywords],
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "shopping",
  referrer: "origin-when-cross-origin",
  robots: PUBLIC_ROBOTS,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: "/",
    title: DEFAULT_TITLE,
    description: SITE.description,
    images: [FALLBACK_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: SITE.description,
    images: [FALLBACK_IMAGE],
  },
} satisfies Metadata
