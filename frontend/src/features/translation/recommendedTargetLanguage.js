export default function recommendedTargetLanguage(sourceLanguage, supportedTargets, preferredLanguage) {
  const preferredForSource = sourceLanguage === 'hi' ? 'en' : sourceLanguage === 'en' ? 'hi' : '';
  const defaultForAuto = sourceLanguage === 'auto' ? 'hi' : '';
  const candidates = [preferredForSource, defaultForAuto, preferredLanguage, 'hi', 'en'];
  return candidates.find((language) => language && supportedTargets.includes(language)) || supportedTargets[0] || '';
}
