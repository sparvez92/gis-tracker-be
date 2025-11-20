export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/summary",
      handler: "dashboard.summary",
    },

    {
      method: "GET",
      path: "/dashboard/generateProjectPDF",
      handler: "dashboard.generateProjectPDF",
    },

    {
      method: "POST",
      path: "/dashboard/upload-csv",
      handler: "dashboard.uploadCsv",
    },
  ],
};