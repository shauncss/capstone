const FIXED_OVERHEAD_MIN = 25; // registration + triage buffer
const AVG_SERVICE_TIME_MIN = 12; // average provider service duration

/**
 * Returns ETA in minutes for the next patient.
 * @param {number} queueLength - number of patients currently waiting
 * @returns {number}
 */
function calculateEta(queueLength = 0) {
  const realTimeWait = queueLength * AVG_SERVICE_TIME_MIN;
  return FIXED_OVERHEAD_MIN + realTimeWait;
}

module.exports = {
  calculateEta,
  FIXED_OVERHEAD_MIN,
  AVG_SERVICE_TIME_MIN
};
