# Job2go web app

React + Vite + TypeScript + Tailwind + shadcn/ui + Motion. One set of screens, two data sources:

- `/` the showcase and `/demo` run on invented sample data (`src/demo/`), entirely in the browser.
- `/app` is your own app: it talks to `serve.py` on your computer (`src/live/`, the only folder allowed to).

```bash
npm install
npm run dev            # http://localhost:5173 (calls to /api go to serve.py on 127.0.0.1:8765)
npm run build:public   # the public website: showcase + demo only, /app is left out of the files
```

Design rules: see `../DESIGN.md`.
