// The 5 steps of "How it works", in order. They follow the real pipeline:
// run.py searches -> prefilter.py filters -> scoring.py scores -> tailor.py writes the pack -> you apply.
export const TOUR_STEPS = [
  {
    id: 'search',
    title: 'Runs on your computer',
    text: 'Every morning it searches LinkedIn, Indeed, InfoJobs and four remote job boards for you.'
  },
  {
    id: 'filter',
    title: 'Filters out the noise',
    text: "Wrong city, a language you don't speak, a title you never want: dropped for free, before any AI."
  },
  {
    id: 'score',
    title: 'Scores every job',
    text: 'An AI scores each job from 1 to 10 and shows what fits, what you would learn and any red flags.'
  },
  {
    id: 'pack',
    title: 'Writes your application pack',
    text: 'For the jobs you pick, it writes a tailored CV and cover letter, plus interview prep.'
  },
  {
    id: 'control',
    title: 'You stay in control',
    text: 'Nothing is sent for you. You apply yourself, then move the job to Applied.'
  },
] as const
