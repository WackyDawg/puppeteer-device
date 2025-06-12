import { fork } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const numBots = parseInt(process.env.BOTS || os.cpus().length, 10);
console.log(`Starting ${numBots} Puppeteer bots...`);

for (let i = 0; i < numBots; i++) {
  const bot = fork(path.join(__dirname, 'device.js'), [i]);
  bot.on('exit', code => {
    console.log(`Bot ${i} exited with code ${code}`);
  });
}
