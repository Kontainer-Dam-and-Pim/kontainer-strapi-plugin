export default {
  default: {
    // Kontainer tenant URL the picker opens, e.g. https://yourcompany.kontainer.com
    url: '',
  },
  validator(config: { url?: unknown }) {
    if (config.url && typeof config.url !== 'string') {
      throw new Error('kontainer plugin: `url` must be a string');
    }
  },
};
