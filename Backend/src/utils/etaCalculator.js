const FIXED_OVERHEAD_MIN = 5; // reduced reg time
const AVG_SERVICE_TIME_MIN = 12; // average provider service duration
const ACTIVE_DOCTORS = 2; //fix to 2 doctors

/**
 * Returns ETA in minutes for the next patient.
 * @param {number} queueLength - number of patients currently waiting
 * @returns {number}
 */

function calculateEta(queueLength = 0) {
  const rounds = Math.floor(queueLength / ACTIVE_DOCTORS);
  const realTimeWait = rounds * AVG_SERVICE_TIME_MIN;
  return FIXED_OVERHEAD_MIN + realTimeWait;
}

module.exports = {
  calculateEta,
  FIXED_OVERHEAD_MIN,
  AVG_SERVICE_TIME_MIN
};
