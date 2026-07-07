export default () => ({
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/config',
      handler: 'controller.config',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/settings',
      handler: 'controller.getSettings',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'PUT',
      path: '/settings',
      handler: 'controller.updateSettings',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/settings/validate',
      handler: 'controller.validateSettings',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
  ],
});
