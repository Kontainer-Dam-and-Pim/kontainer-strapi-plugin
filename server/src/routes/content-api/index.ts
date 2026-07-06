export default () => ({
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/usage/:fileId",
      handler: "controller.usage",
      config: {
        policies: [],
      },
    },
  ],
});
