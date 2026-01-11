/**
 * Generate 4-digit int
 * @param {string|null} lastQueueNumber - last queue number
 * @returns {string} - new queue number
 */
function generateNextQueueNumber(lastQueueNumber) {
  // If no queue number, start at 0000
  if (!lastQueueNumber) {
    return '0000';
  }

  // Check if the last number follows the 4-digit format
  const match = lastQueueNumber.match(/^(\d{4})$/);

  if (!match) {
    return '0000';
  }

  // Parse, increment, and loop back
  const current = parseInt(match[1], 10);
  const next = (current + 1) % 10000; // Loops back to 0 after 9999

  // Pad with leading zeros (e.g., 5 -> "0005")
  return String(next).padStart(4, '0');
}

module.exports = { generateNextQueueNumber };