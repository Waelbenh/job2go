import { BuiltBy } from '@/components/showcase/BuiltBy'
import { Features } from '@/components/showcase/Features'
import { ScrollStory } from '@/components/showcase/ScrollStory'
import { ShowcaseFooter } from '@/components/showcase/ShowcaseFooter'
import { ShowcaseNav } from '@/components/showcase/ShowcaseNav'

/** "/" — the public showcase and portfolio page. SAMPLE data only (src/demo/sampleData.ts). */
export function ShowcasePage() {
  return (
    <>
      <span id="top" aria-hidden />
      <ShowcaseNav />
      <main>
        <ScrollStory />
        <Features />
        <BuiltBy />
      </main>
      <ShowcaseFooter />
    </>
  )
}
