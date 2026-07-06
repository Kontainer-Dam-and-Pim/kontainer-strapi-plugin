export default () => ({
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/config",
      handler: "controller.config",
      config: {
        policies: [],
      },
    },
  ],
});
