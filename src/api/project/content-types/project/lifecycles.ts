const REQUIRED_DATES = [
  "const_start_date",
  "const_end_date",
  "rest_start_date",
  "rest_end_date",
];

export default {
  /**
   * Before create or update
   */
  async beforeCreate(event) {
    await markProjectCompletion(event);
  },

  async beforeUpdate(event) {
    await markProjectCompletion(event);
  },
};

async function markProjectCompletion(event) {
  const data = event.params.data;

  // Check if all required dates are present
  const allDatesPresent = REQUIRED_DATES.every(
    (field) =>
      data[field] !== null && data[field] !== undefined && data[field] !== ""
  );

  if (allDatesPresent) {
    data.project_status = "completed"; // MUST match your enum key
  } else {
    // Optional: reset status if incomplete
    // data.project_status = 'in_progress';
  }
}
