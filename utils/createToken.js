const crypto = require('crypto');

function generateRandomToken() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(10, (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer.toString('hex'));
      }
    });
  });
}

module.exports = {
    generateRandomToken
}