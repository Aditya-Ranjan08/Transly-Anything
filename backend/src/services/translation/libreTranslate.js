const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.TRANSLATION_TIMEOUT_MS) || 30000);
const LANGUAGE_CACHE_TTL_MS = 60000;
const providerNames = ['deepl', 'libretranslate', 'google', 'azure'];
const languageCache = new Map();

function configuredProviderNames() {
  const primary = (process.env.TRANSLATION_PROVIDER || '').trim().toLowerCase();
  const configuredOrder = (process.env.TRANSLATION_PROVIDER_ORDER || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  const order = [...new Set([primary, ...(configuredOrder.length ? configuredOrder : providerNames)].filter((name) => providerNames.includes(name)))];
  return order.filter(isProviderConfigured);
}

function isProviderConfigured(provider) {
  if (provider === 'deepl') return Boolean(process.env.DEEPL_API_KEY?.trim());
  if (provider === 'libretranslate') return Boolean(process.env.TRANSLATION_API_URL?.trim());
  if (provider === 'google') return Boolean(process.env.GOOGLE_TRANSLATE_API_KEY?.trim());
  if (provider === 'azure') return Boolean(process.env.AZURE_TRANSLATOR_KEY?.trim());
  return false;
}

function libreBaseUrl() {
  return (process.env.TRANSLATION_API_URL || '').trim().replace(/\/+$/, '');
}

function deeplBaseUrl() {
  const configuredUrl = process.env.DEEPL_API_URL?.trim().replace(/\/+$/, '');
  if (configuredUrl) return configuredUrl;
  const key = process.env.DEEPL_API_KEY.trim();
  return key.endsWith(':fx') ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2';
}

function azureBaseUrl() {
  return (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').trim().replace(/\/+$/, '');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Translation provider returned HTTP ${response.status}.`);
    error.status = response.status === 429 || response.status === 456 ? 429 : response.status;
    throw error;
  }
  return payload;
}

function normalizeLanguage(code) {
  const normalized = String(code || '').trim().toLowerCase().replaceAll('_', '-');
  if (normalized === 'auto') return 'auto';
  if (normalized.startsWith('en-')) return 'en';
  if (normalized.startsWith('pt-')) return 'pt';
  if (normalized.startsWith('zh-')) return 'zh';
  return normalized;
}

function languageDisplayName(code, name = '') {
  return String(name || code || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function pairsFromLanguages(sources, targets) {
  return sources.flatMap((source) => targets
    .filter((target) => target.code !== source.code)
    .map((target) => ({ source: source.code, target: target.code })));
}

async function libreLanguages() {
  const data = await requestJson(`${libreBaseUrl()}/languages`, { headers: { Accept: 'application/json' } });
  if (!Array.isArray(data)) throw new Error('LibreTranslate returned an invalid language list.');
  const languages = data.map(({ code, name, targets }) => ({
    code: normalizeLanguage(code),
    name: languageDisplayName(code, name),
    targets: Array.isArray(targets) ? targets.map(normalizeLanguage) : [],
  })).filter((language) => language.code && language.name);
  const pairs = languages.flatMap((language) => language.targets.map((target) => ({ source: language.code, target })));
  return { languages, pairs };
}

async function deeplLanguages() {
  const headers = { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY.trim()}`, Accept: 'application/json' };
  const [sourceData, targetData] = await Promise.all([
    requestJson(`${deeplBaseUrl()}/languages?type=source`, { headers }),
    requestJson(`${deeplBaseUrl()}/languages?type=target`, { headers }),
  ]);
  const sources = (Array.isArray(sourceData) ? sourceData : []).map(({ language, name }) => ({ code: normalizeLanguage(language), name: languageDisplayName(language, name) }));
  const targets = (Array.isArray(targetData) ? targetData : []).map(({ language, name }) => ({ code: normalizeLanguage(language), name: languageDisplayName(language, name) }));
  return { languages: [...new Map([...sources, ...targets].map((language) => [language.code, language])).values()], pairs: pairsFromLanguages(sources, targets) };
}

async function googleLanguages() {
  const url = new URL('https://translation.googleapis.com/language/translate/v2/languages');
  url.searchParams.set('target', 'en');
  url.searchParams.set('key', process.env.GOOGLE_TRANSLATE_API_KEY.trim());
  const payload = await requestJson(url, { headers: { Accept: 'application/json' } });
  const languages = (payload.data?.languages || []).map(({ language, name }) => ({ code: normalizeLanguage(language), name: languageDisplayName(language, name) }));
  return { languages, pairs: pairsFromLanguages(languages, languages) };
}

async function azureLanguages() {
  const url = new URL(`${azureBaseUrl()}/languages`);
  url.searchParams.set('api-version', '3.0');
  url.searchParams.set('scope', 'translation');
  const payload = await requestJson(url, { headers: { Accept: 'application/json' } });
  const languages = Object.entries(payload.translation || {}).map(([code, details]) => ({ code: normalizeLanguage(code), name: languageDisplayName(code, details.name) }));
  return { languages, pairs: pairsFromLanguages(languages, languages) };
}

const languageLoaders = {
  deepl: deeplLanguages,
  libretranslate: libreLanguages,
  google: googleLanguages,
  azure: azureLanguages,
};

function cacheLanguages(provider, value) {
  languageCache.set(provider, { expiresAt: Date.now() + LANGUAGE_CACHE_TTL_MS, value });
  return value;
}

async function getProviderLanguages(provider, { refresh = false } = {}) {
  const cached = languageCache.get(provider);
  if (!refresh && cached?.expiresAt > Date.now()) return cached.value;
  return cacheLanguages(provider, await languageLoaders[provider]());
}

function mergeCapabilities(results) {
  const languages = new Map();
  const pairs = new Map();
  for (const { provider, capabilities } of results) {
    for (const language of capabilities.languages) {
      const existing = languages.get(language.code);
      if (!existing || (!existing.providers?.includes(provider))) {
        languages.set(language.code, {
          ...existing,
          ...language,
          providers: [...new Set([...(existing?.providers || []), provider])],
        });
      }
    }
    for (const pair of capabilities.pairs) {
      const key = `${pair.source}:${pair.target}`;
      const existing = pairs.get(key);
      pairs.set(key, { ...pair, providers: [...new Set([...(existing?.providers || []), provider])] });
    }
  }
  return { languages: [...languages.values()].sort((a, b) => a.name.localeCompare(b.name)), pairs: [...pairs.values()] };
}

export async function getAvailableLanguages({ refresh = false } = {}) {
  const configured = configuredProviderNames();
  const results = await Promise.all(configured.map(async (provider) => {
    try {
      return { provider, capabilities: await getProviderLanguages(provider, { refresh }) };
    } catch {
      return null;
    }
  }));
  const reachable = results.filter(Boolean);
  return { ...mergeCapabilities(reachable), activeProviders: reachable.map(({ provider }) => provider) };
}

export async function getCapabilities() {
  const maxFileSize = Math.max(1024, Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024);
  const configured = configuredProviderNames();
  if (!configured.length) {
    return { configured: false, reachable: false, providers: [], languages: [], pairs: [], maxFileSize, message: 'Configure at least one translation provider in the backend environment.' };
  }
  const results = await Promise.all(configured.map(async (provider) => {
    try {
      return { provider, capabilities: await getProviderLanguages(provider) };
    } catch {
      return null;
    }
  }));
  const reachable = results.filter(Boolean);
  const merged = mergeCapabilities(reachable);
  return {
    configured: true,
    reachable: reachable.length > 0,
    providers: configured,
    activeProviders: reachable.map(({ provider }) => provider),
    languages: merged.languages,
    pairs: merged.pairs,
    maxFileSize,
    ...(reachable.length ? {} : { message: 'No configured translation provider is reachable right now.' }),
  };
}

export async function supportsPair(source, target) {
  const capabilities = await getAvailableLanguages();
  if (!capabilities.activeProviders.length && configuredProviderNames().length) {
    const error = new Error('No configured translation provider is reachable right now.');
    error.status = 503;
    throw error;
  }
  const to = normalizeLanguage(target);
  const from = normalizeLanguage(source);
  if (!to || !capabilities.languages.some((language) => language.code === to)) return false;
  if (from === 'auto') return true;
  return capabilities.pairs.some((pair) => pair.source === from && pair.target === to);
}

function languageForDeepL(code, { target = false } = {}) {
  const normalized = normalizeLanguage(code);
  if (normalized === 'auto') return '';
  if (normalized === 'en') return target ? 'EN-US' : 'EN';
  if (normalized === 'pt') return target ? 'PT-PT' : 'PT';
  if (normalized === 'zh') return target ? 'ZH-HANS' : 'ZH';
  return normalized.toUpperCase();
}

async function translateWithDeepL(text, source, target) {
  const body = { text: [text], target_lang: languageForDeepL(target, { target: true }) };
  const sourceLanguage = languageForDeepL(source);
  if (sourceLanguage) body.source_lang = sourceLanguage;
  const result = await requestJson(`${deeplBaseUrl()}/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY.trim()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const translated = result.translations?.[0]?.text;
  if (typeof translated !== 'string') throw new Error('DeepL did not return translated text.');
  return translated;
}

async function translateWithLibreTranslate(text, source, target) {
  const body = { q: text, source: normalizeLanguage(source), target: normalizeLanguage(target), format: 'text' };
  if (process.env.TRANSLATION_API_KEY?.trim()) body.api_key = process.env.TRANSLATION_API_KEY.trim();
  const result = await requestJson(`${libreBaseUrl()}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (typeof result.translatedText !== 'string') throw new Error('LibreTranslate did not return translated text.');
  return result.translatedText;
}

async function translateWithGoogle(text, source, target) {
  const url = new URL('https://translation.googleapis.com/language/translate/v2');
  url.searchParams.set('key', process.env.GOOGLE_TRANSLATE_API_KEY.trim());
  const body = { q: text, target: normalizeLanguage(target), format: 'text' };
  if (normalizeLanguage(source) !== 'auto') body.source = normalizeLanguage(source);
  const result = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const translated = result.data?.translations?.[0]?.translatedText;
  if (typeof translated !== 'string') throw new Error('Google Cloud Translation did not return translated text.');
  return translated;
}

async function translateWithAzure(text, source, target) {
  const url = new URL(`${azureBaseUrl()}/translate`);
  url.searchParams.set('api-version', '3.0');
  url.searchParams.set('to', normalizeLanguage(target));
  const sourceLanguage = normalizeLanguage(source);
  if (sourceLanguage !== 'auto') url.searchParams.set('from', sourceLanguage);
  const headers = {
    'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY.trim(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (process.env.AZURE_TRANSLATOR_REGION?.trim()) headers['Ocp-Apim-Subscription-Region'] = process.env.AZURE_TRANSLATOR_REGION.trim();
  const result = await requestJson(url, { method: 'POST', headers, body: JSON.stringify([{ Text: text }]) });
  const translated = result[0]?.translations?.[0]?.text;
  if (typeof translated !== 'string') throw new Error('Azure Translator did not return translated text.');
  return translated;
}

const translators = {
  deepl: translateWithDeepL,
  libretranslate: translateWithLibreTranslate,
  google: translateWithGoogle,
  azure: translateWithAzure,
};

export async function translateText(text, source, target) {
  if (!text.trim()) return '';
  const configured = configuredProviderNames();
  if (!configured.length) {
    const error = new Error('Translation is not configured. Add a supported provider key or URL to backend/.env.');
    error.status = 503;
    throw error;
  }

  const failures = [];
  for (const provider of configured) {
    try {
      return await translators[provider](text, source, target);
    } catch (error) {
      failures.push({ provider, status: error.status });
    }
  }

  const error = new Error(`All configured translation providers failed (${failures.map(({ provider, status }) => `${provider}${status ? ` HTTP ${status}` : ''}`).join(', ')}).`);
  error.status = failures.at(-1)?.status || 503;
  throw error;
}
