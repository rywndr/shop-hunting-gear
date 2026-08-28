"use client"

import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "@/components/ui/carousel"
import { HERO_SLIDES } from "@/lib/site-config"

const arrowClassName =
  "hidden size-9 border-navbar-border bg-navbar/50 text-navbar-foreground backdrop-blur-sm hover:bg-navbar/80 hover:text-navbar-foreground md:inline-flex"

function HeroDots() {
  const { api, selectedIndex } = useCarousel()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 md:bottom-8">
      <div className="mx-auto flex max-w-7xl gap-2 px-4">
        {HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => api?.scrollTo(index)}
            aria-label={`Slide ${index + 1}: ${slide.title}`}
            aria-current={index === selectedIndex}
            className="pointer-events-auto h-1.5 w-8 bg-navbar-foreground/40 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=true]:bg-navbar-foreground"
          />
        ))}
      </div>
    </div>
  )
}

function HeroCarousel({ className }: { className?: string }) {
  return (
    <Carousel opts={{ loop: true }} aria-label="Promosi" className={className}>
      <CarouselContent className="ml-0">
        {HERO_SLIDES.map((slide, index) => (
          <CarouselItem key={slide.image} className="pl-0">
            <div className="relative aspect-square w-full sm:aspect-16/10 md:aspect-auto md:h-[480px] lg:h-[540px]">
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                sizes="100vw"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                style={{ objectPosition: slide.focus }}
                className="object-cover"
              />

              <div className="absolute inset-0 bg-linear-to-t from-navbar/95 via-navbar/40 via-60% to-navbar/10 md:bg-linear-to-r md:via-50%" />

              <div className="absolute inset-0 flex items-end">
                <div className="mx-auto w-full max-w-7xl px-4 pb-14 md:pb-16">
                  <div className="max-w-lg">
                    <p className="font-heading text-xs font-bold tracking-[0.2em] text-navbar-foreground/70 uppercase">
                      {slide.eyebrow}
                    </p>
                    <h2 className="mt-2 font-heading text-2xl leading-tight font-bold tracking-tight text-navbar-foreground uppercase sm:text-3xl md:text-4xl">
                      {slide.title}
                    </h2>
                    <p className="mt-2 text-sm text-navbar-foreground/80 sm:text-base">
                      {slide.body}
                    </p>
                    <Button
                      render={<Link href={slide.cta.href} />}
                      nativeButton={false}
                      size="lg"
                      className="mt-4 h-11 bg-navbar-foreground px-6 text-sm font-bold tracking-wide text-navbar uppercase hover:bg-navbar-foreground/85"
                    >
                      {slide.cta.label}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious className={`${arrowClassName} left-4`} />
      <CarouselNext className={`${arrowClassName} right-4`} />
      <HeroDots />
    </Carousel>
  )
}

export { HeroCarousel }
