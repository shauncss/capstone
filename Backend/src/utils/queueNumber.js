const { customAlphabet } = require('nanoid');

const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 3);

function generateQueueNumber(prefix = 'Q') {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  return `${prefix}${day}${hour}${nanoid()}`;
}

module.exports = { generateQueueNumber };
