const TorRunner = require('./tor/bundle/tor');
const tr = require('tor-request');

function startTorProxy(callback) {
  const tor = new TorRunner();
  tor.on('ready', () => {
    if (callback) callback();
  });
  tor.start();  
}

function requestThroughTor(url, cb) {
  tr.request(url, function (err, res, body) {
    if (!err && res.statusCode === 200) {
      cb(null, body);
    } else {
      cb(err || new Error(`Status code: ${res.statusCode}`));
    }
  });
}

module.exports = {
  startTorProxy,
  requestThroughTor
};
