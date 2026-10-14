import { useInView } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { AppSidebar, AppTopBar } from '@/components/app/AppFrame'
import { DashboardView } from '@/components/app/DashboardView'
import { AppWindow } from './AppWindow'
import { useHeroScene } from './useHeroScene'
import { sampleArriving, sampleBestMatch, sampleNewToday, sampleStats } from '@/demo/sampleData'

// The app is drawn at a real app size, then scaled, so the preview IS the real dashboard.
// Wide screens: desktop layout, never smaller than 86% so the text stays readable - if the column
// is too narrow, the window simply runs off the right edge. Phones: the app's own narrow layout.
// 940 px wide: the app's own layout without the sidebar, so the best match fits and stays readable
const DESKTOP = { width: 940, height: 840, minScale: 0.86 }
const PHONE = { width: 440, height: 1000, minScale: 0 }

export function HeroPreview() {
  const outer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const inView = useInView(outer, { amount: 0.3 })

  // Keep the scale right when the window is resized
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { loop, arrived, packState } = useHeroScene(inView)

  const size = width && width < 640 ? PHONE : DESKTOP
  const scale = width ? Math.max(width / size.width, size.minScale) : 0
  const jobs = arrived ? [sampleArriving, ...sampleNewToday] : sampleNewToday

  return (
    // The scaled app is taken out of the page flow (absolute): scale() only changes how it LOOKS,
    // so in the flow it would still take its full app width and push the page wider than a phone.
    // No overflow clip here: inside the tilted (3D) hero, Chrome then thinks the score ring is
    // off screen and never starts its animation. The hero section clips at the screen edge instead.
    <div ref={outer} className="relative w-full min-w-0" style={{ height: size.height * scale }}>
      {scale > 0 && (
        <AppWindow
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          // the window fades out at the bottom, so the cut looks intended
          bodyClassName="[mask-image:linear-gradient(to_bottom,black_86%,transparent)]"
        >
          <div className="hidden @5xl:block">
            <AppSidebar active="dashboard" counts={{ jobs: sampleStats.good, board: sampleStats.applied }} />
          </div>
          <div className="@container min-w-0 flex-1 overflow-hidden">
            <AppTopBar />
            <DashboardView stats={sampleStats} best={sampleBestMatch} newToday={jobs} packState={packState} ringKey={loop} />
          </div>
        </AppWindow>
      )}
    </div>
  )
}
