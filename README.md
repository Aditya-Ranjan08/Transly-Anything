# Transly

Transly is a document translation application. The repository is organized as an npm workspace with a Vite/React client and an Express API.

## Prerequisites

- Node.js 20.19+ or 22.12+ (Node 24 is also suitable)
- npm
- MongoDB connection string when database features are added

## Install and run

```bash
npm install
Copy-Item backend/.env.example backend/.env
npm run dev
```

Before starting the app, edit `backend/.env` and set `MONGODB_URI` and a private `JWT_SECRET` (at least 32 random characters). Keep this file uncommitted. The frontend uses the Vite `/api` proxy by default; set `VITE_API_URL` only when the API is hosted separately.

The backend bundles the SIL Open Font License Noto Sans Devanagari font in `backend/fonts/`. `PDF_FONT_PATH=./fonts/NotoSansDevanagari.ttf` is resolved relative to the backend directory and is used when translated text contains Devanagari characters.

Translation requests use the configured provider order and automatically try the next provider when one fails. Supported providers are DeepL, LibreTranslate, Google Cloud Translation Basic, and Azure Translator. Set provider credentials only in `backend/.env`; do not commit that file. DeepL uses `DEEPL_API_KEY` (and detects the free or Pro endpoint from the key unless `DEEPL_API_URL` is set), LibreTranslate uses `TRANSLATION_API_URL` and optional `TRANSLATION_API_KEY`, Google uses `GOOGLE_TRANSLATE_API_KEY`, and Azure uses `AZURE_TRANSLATOR_KEY` with optional region and endpoint settings. Providers without credentials are skipped. The default order is DeepL, LibreTranslate, Google, then Azure; override it with `TRANSLATION_PROVIDER_ORDER`.

PDF, image, and plain-text translations all create the same tracked job and result flow. Image OCR uses Tesseract.js; its language data downloads on first use and is cached by Tesseract.js. `TESSERACT_AUTO_LANGUAGES` sets the OCR languages for auto-detected images (default `eng+hin+spa+fra`); when a source language is chosen, the matching English, Hindi, Spanish, or French OCR model is used. Plain text input is limited by `MAX_TEXT_CHARACTERS` (default 50,000).

The client runs on `http://localhost:5173`; the API runs on `http://localhost:5000`. Registration and login create an HttpOnly session cookie. The dashboard requires a valid session. Translation and document-processing behavior will be added in later milestones.

## Deploy the frontend to Vercel

The Render service hosts the API only; its root URL is not a frontend page. Check `https://transly-anything.onrender.com/api/health` to verify the API. Deploy the frontend separately to Vercel and set the Vercel project's Root Directory to `frontend`. The included `frontend/vercel.json` routes browser requests for React pages (such as `/login` and `/dashboard`) back to the Vite app, so opening or refreshing those URLs does not return Vercel's 404 page.

Set these deployment environment variables:

- **Vercel**: `VITE_API_URL=https://transly-anything.onrender.com/api`. Production builds use this Render API URL if the variable is blank or a relative path.
- **Render**: Set `NODE_ENV=production`, `CLIENT_URL=https://transly-anything-adi.vercel.app`, `MONGODB_URI`, and a private random `JWT_SECRET` with at least 32 characters. Set the translation provider's credentials as needed. The backend allows the listed Vercel origin and local development by default; `CLIENT_URL` adds frontend origins. Keep the exact scheme and hostname; do not include a path.

After backend code or environment changes, redeploy the Render service. The backend uses credentialed CORS and secure cross-site session cookies unless explicitly configured for local development (`NODE_ENV=development` and a localhost-only `CLIENT_URL`). Keep `withCredentials` enabled in the frontend and do not use a wildcard CORS origin.

## Workspace layout

- `frontend/`: React, Vite, Tailwind CSS and browser application
- `backend/`: Express API, configuration, middleware, models and service modules
