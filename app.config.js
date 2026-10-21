/**
 * app.json holds the static config. This only adds the web base URL, which depends on where the web build
 * is hosted: GitHub Pages serves it from /thali-tally/, the downloadable web zip is meant for a site root.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
