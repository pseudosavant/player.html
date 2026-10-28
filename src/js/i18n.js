const global = window;
const catalogs = new Map();
const sources = new Map([...document.querySelectorAll('script[data-locale]')].map(node => [node.dataset.locale, node]));
const locales = [...sources].map(([locale, node]) => ({ locale, name: node.dataset.name, dir: node.dataset.dir || 'ltr' }));
let locale = 'en';
let preference = 'auto';
let defaultLanguage = 'en';
let numbers = new Intl.NumberFormat(locale);
let plurals = new Intl.PluralRules(locale);
const englishPlurals = new Intl.PluralRules('en');
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const match = value => {
  if (typeof value !== 'string') return null;
  try {
    const candidate = new Intl.Locale(value);
    if (candidate.language === 'zh') {
      const code = `zh-${candidate.maximize().script}`;
      return sources.has(code) ? code : null;
    }
    if (!sources.has(candidate.language)) return null;
    const supportedScript = new Intl.Locale(candidate.language).maximize().script;
    return candidate.script && candidate.script !== supportedScript ? null : candidate.language;
  } catch (error) {
    return null;
  }
};
const catalog = code => {
  if (!catalogs.has(code)) {
    const source = sources.get(code);
    catalogs.set(code, source ? JSON.parse(source.textContent).messages : {});
  }
  return catalogs.get(code);
};
const t = (key, params = {}) => {
  const translated = own(catalog(locale), key);
  let message = translated ? catalog(locale)[key] : own(catalog('en'), key) ? catalog('en')[key] : key;
  if (typeof message === 'object') message = message[(translated ? plurals : englishPlurals).select(Number(params.count))] ?? message.other;
  return String(message).replace(/\{(\w+)\}/g, (token, name) => {
    if (!own(params, name)) return token;
    const value = String(params[name]);
    return document.documentElement.dir === 'rtl' ? `\u2068${value}\u2069` : value;
  });
};
const apply = (root = document) => {
  const selector = '[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder], [data-i18n-content]';
  const nodes = [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  for (const node of nodes) {
    const params = node.dataset.i18nParams ? JSON.parse(node.dataset.i18nParams) : {};
    if (node.dataset.i18n) node.textContent = t(node.dataset.i18n, params);
    for (const attribute of ['title', 'aria-label', 'placeholder', 'content']) {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      if (key) node.setAttribute(attribute, t(key, params));
    }
  }
};
const resolve = () => {
  const explicit = preference !== 'auto' && match(preference);
  if (explicit) return explicit;
  for (const candidate of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const supported = match(candidate);
    if (supported) return supported;
  }
  return match(defaultLanguage) || 'en';
};
const setLanguage = value => {
  preference = value === 'auto' || !match(value) ? 'auto' : match(value);
  const next = resolve();
  const changed = next !== locale;
  locale = next;
  numbers = new Intl.NumberFormat(locale);
  plurals = new Intl.PluralRules(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = locales.find(item => item.locale === locale)?.dir || 'ltr';
  for (const name of ['drop', 'on', 'off']) {
    global.setCSSVariableString(`--label-${name}`, t(`ui.${name}`).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\f]/g, ' '));
  }
  apply();
  if (changed) global.dispatchEvent(new Event('playerlanguagechange'));
};
global.i18n = {
  t, apply, match, locales, setLanguage,
  get locale() { return locale; },
  get preference() { return preference; },
  number: (value, options) => options ? new Intl.NumberFormat(locale, options).format(value) : numbers.format(value),
  initialize: fallback => {
    defaultLanguage = fallback;
    setLanguage(global.storageRetrieve('setting-language') || 'auto');
  }
};
catalog('en');
global.addEventListener('languagechange', () => { if (preference === 'auto') setLanguage('auto'); });
