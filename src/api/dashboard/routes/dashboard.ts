export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/summary",
      handler: "dashboard.summary",
      config: {
        auth: false,
      },
    },

    {
      method: "GET",
      path: "/dashboard/generateProjectPDF",
      handler: "dashboard.generateProjectPDF",
      config: {
        auth: false,
      },
    },

    {
      method: "POST",
      path: "/dashboard/upload-csv",
      handler: "dashboard.uploadCsv",
      config: {
        auth: false,
      },
    },
  ],
};