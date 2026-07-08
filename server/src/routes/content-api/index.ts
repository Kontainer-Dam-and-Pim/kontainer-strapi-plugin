export default () => ({
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/usage/:fileId',
      handler: 'controller.usage',
      config: {
        policies: [],
      },
    },
    {
      // Polled by Kontainer for file usages. Public route (auth: false) —
      // the controller checks the bearer token from plugin settings itself.
      method: 'GET',
      path: '/file/usages',
      handler: 'controller.fileUsages',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
