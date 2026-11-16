const { buildProxyRules } = require('./rules');

module.exports = {
  // Rules go in front: the function rewrites and the SPA fallback in netlify.toml
  // would otherwise match first. A plugin is needed because only config-level
  // rules (not _redirects) can carry `signed`, and the target differs per site.
  onPreBuild({ netlifyConfig, utils }) {
    const apiOrigin = process.env.API_ORIGIN;
    let rules;
    try {
      rules = buildProxyRules(apiOrigin);
    } catch (err) {
      return utils.build.failBuild(`api-proxy: ${err.message}`);
    }
    netlifyConfig.redirects.unshift(...rules);
    console.log(`api-proxy: API_ORIGIN=${apiOrigin} → ${rules.length} rules injected`);
  },
};
