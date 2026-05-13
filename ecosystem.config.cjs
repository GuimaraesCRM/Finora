module.exports = {
  apps: [
    {
      name: "finora",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        APP_PORT: "3333",
      },
    },
  ],
};
