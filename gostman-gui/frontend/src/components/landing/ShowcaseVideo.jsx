import { useEffect, useRef } from "react"
import { cn } from "../../lib/utils"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
const VISIBLE_SHARE = 0.4

const savesData = () => Boolean(navigator.connection?.saveData)
const mayAutoplay = () => !window.matchMedia(REDUCED_MOTION).matches && !savesData()

function usePlayWhenVisible(ref) {
  useEffect(() => {
    const video = ref.current
    if (!video || !mayAutoplay() || !("IntersectionObserver" in window)) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: VISIBLE_SHARE }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [ref])
}

export function ShowcaseVideo({ src, poster, label, className }) {
  const ref = useRef(null)
  usePlayWhenVisible(ref)

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      className={cn("block h-full w-full object-cover", className)}
    />
  )
}
