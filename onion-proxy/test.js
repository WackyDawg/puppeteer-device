const onionProxy = require('./app.js');
onionProxy.startTorProxy(() => {
  onionProxy.requestThroughTor('https://api.bigdatacloud.net/data/client-ip', (err, ip) => {
    if (err) return console.error(err);
    console.log('Your Tor IP:', ip);
  });
});