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

## Workspace layout

- `frontend/`: React, Vite, Tailwind CSS and browser application
- `backend/`: Express API, configuration, middleware, models and service modules
