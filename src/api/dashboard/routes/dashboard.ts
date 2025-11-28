export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/summary",
      handler: "dashboard.summary",
    },

    {
      method: "GET",
      path: "/dashboard/generateProjectPDF/:documentId",
      handler: "dashboard.generateProjectPDF",
    },

    {
      method: "POST",
      path: "/dashboard/upload-csv",
      handler: "dashboard.uploadCsv",
    },

    {
      method: 'GET',
      path: '/dashboard/count-by-date',
      handler: 'dashboard.countByDate',
    },

    {
      method: 'GET',
      path: '/dashboard/project-by-type',
      handler: 'dashboard.projectByType',
    },
  ],
};