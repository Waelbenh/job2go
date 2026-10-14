import { liveSource } from '@/live/api'
import { AppLayout } from './AppLayout'

/** "/app": the app with your real jobs, through serve.py (never in the public build, see App.tsx) */
export default function LiveApp() {
  return <AppLayout source={liveSource} base="/app" />
}
