import { connect } from "puppeteer-real-browser";
import { newInjectedPage } from "fingerprint-injector";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, User } from "discord.js";
import dotenv from "dotenv";
import chalk from "chalk";
import onionProxy from "./onion-proxy/app.js";
import UserAgent from "user-agents";
import FormData from "form-data";
import axios from 'axios';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;

// Configuration Constants
const CONFIG = {
  DISCORD_INTENTS: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  BROWSER_ARGS: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--proxy-server=socks5://127.0.0.1:9050",
    "--disable-features=site-per-process",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--disable-web-security",
    "--webrtc-ip-handling-policy=disable_non_proxied_udp",
    "--force-webrtc-ip-handling-policy",
  ],
  TOR_CHECK_URL: "https://ip-scan.browserscan.net/sys/config/ip/get-visitor-ip",
};

// Utility Functions
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

// const userAgent = new UserAgent({ deviceCategory: 'mobile' });
// const userAgentData = userAgent.data;
// console.log(userAgentData)


// Discord Client Setup
const discordClient = new Client({ intents: CONFIG.DISCORD_INTENTS });

discordClient.once("ready", () => {
  console.log(`🤖 Logged into Discord as ${discordClient.user.tag}`);
});

// Tor Functions
async function getTorIdentity() {
  try {
    const response = await new Promise((resolve, reject) => {
      onionProxy.requestThroughTor(CONFIG.TOR_CHECK_URL, (err, res) => {
        err ? reject(err) : resolve(res);
      });
    });

    const json = JSON.parse(response);
    if (!json?.data?.ip || !json?.data?.ip_data?.timezone) {
      throw new Error("Missing IP or timezone data");
    }

    return {
      ip: json.data.ip,
      timezone: json.data.ip_data.timezone,
    };
  } catch (error) {
    console.error(chalk.red("❌ Tor request failed:"), error);
    throw error;
  }
}

// Browser Functions
async function launchBrowser(timezone) {
  const { browser } = await connect({
    args: CONFIG.BROWSER_ARGS,
    headless: false,
    turnstile: true,
  });

  const browserVersion = await browser.version();
  console.log("🧭 Browser version:", browserVersion);

  //Device Configuration
  const device = process.env.devices;
  const OS = process.env.operatingSystems

  const page = await newInjectedPage(browser, {
    fingerprintOptions: {
      devices: [`${device}`],
      operatingSystems: [`${OS}`],
    },
  });

  await page.emulateTimezone(timezone);
//   await page.emulate({
//     "name": userAgentData.appName,
//     "userAgent": userAgentData.userAgent,
//     "platform": userAgentData.platform,
//     "viewport": {
//       "width": userAgentData.viewportWidth,
//       "height": userAgentData.viewportHeight,
//       "deviceScaleFactor": 1,
//     },
//   });

  return { browser, page };
}

// Discord Command Handlers
function setupDiscordHandlers(client, page) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const [command, ...args] = message.content.trim().split(/\s+/);
    const content = args.join(" ");

    try {
      switch (command) {
        case "!goto":
          await handleGoto(message, page, content);
          break;
        case "!screenshot":
          await handleScreenshot(page);
          break;
        case "!click":
          await handleClick(message, page, content);
          break;
        case "!type":
          await handleType(message, page, args[0], args.slice(1).join(" "));
          break;
        case "!tw-follow":
          await handleTwitchFollow(message, page, content);
          break;
        case "!tw-stream":
          await handleTwitchStream(message, page, content);
          break;
        case "!tw-warmup":
          // Implement warmup logic
          break;
      }
    } catch (error) {
      console.error(`Command error [${command}]:`, error);
    }
  });
}

// Command Handler Implementations
async function handleGoto(message, page, url) {
  if (!url) return message.reply("⚠️ Please provide a URL");
  
  await page.bringToFront();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  await message.reply(`✅ Navigated to ${url}`);
  await delay(3000)
  try {
    const acceptSelector = 'button[data-a-target="consent-banner-accept"]';
  
    const bannerVisible = await page.$(acceptSelector);
    if (bannerVisible) {
      await page.waitForSelector(acceptSelector, { timeout: 5000 });
      await page.click(acceptSelector);
      console.log("✅ Clicked cookie consent 'Accept' button.");
      await delay(1000);
    }
  } catch (err) {
    console.warn("⚠️ Cookie banner not handled:", err.message);
  }
}

async function handleScreenshot(page) {
    await page.bringToFront();
  
    const screenshotPath = `screenshot-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
  
    const form = new FormData();
    form.append('file', fs.createReadStream(screenshotPath));
    form.append('content', '📸 New screenshot captured');
  
    try {
      const response = await axios.post(WEBHOOK_URL, form, {
        headers: form.getHeaders(),
      });
      console.log('✅ Screenshot sent to Discord:', response.status);
    } catch (err) {
      console.error('❌ Error sending to Discord:', err.message);
    }
  
    fs.unlink(screenshotPath, () => {});
  }

async function handleClick(message, page, selector) {
  if (!selector) return message.reply("⚠️ Please provide a selector");
  
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  await message.reply(`Clicked ${selector}`);
}

async function handleType(message, page, selector, text) {
  if (!selector || !text) {
    return message.reply("⚠️ Please provide both selector and text");
  }
  
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.type(selector, text);
  await message.reply(`Typed "${text}" into ${selector}`);
}

async function handleTwitchFollow(message, page, url) {
  if (!url || !url.includes("twitch.tv")) {
    return message.reply("⚠️ Invalid Twitch URL");
  }

  await page.goto(url, { waitUntil: "networkidle0", timeout: 0 });
  await message.reply(`✅ Navigated to ${url}`);
  
  const followButton = 'button[data-a-target="follow-button"]';
  await page.waitForSelector(followButton, { timeout: 10000 });
  await page.click(followButton);
  await message.reply(`Followed ${url}`);
}

async function handleTwitchStream(message, page, url) {
  if (!url || !url.includes("twitch.tv")) {
    return message.reply("⚠️ Invalid Twitch URL");
  }

  await page.goto(url, { waitUntil: "networkidle0", timeout: 0 });
  await message.reply(`✅ Navigated to livestream ${url}`);

  try {
    const acceptSelector = 'button[data-a-target="consent-banner-accept"]';
  
    const bannerVisible = await page.$(acceptSelector);
    if (bannerVisible) {
      await page.waitForSelector(acceptSelector, { timeout: 5000 });
      await page.click(acceptSelector);
      console.log("✅ Clicked cookie consent 'Accept' button.");
      await delay(1000);
    }
  } catch (err) {
    console.warn("⚠️ Cookie banner not handled:", err.message);
  }
  await delay(5000);
  await page.evaluate(() => {
    localStorage.setItem("mature", "true");
    localStorage.setItem("video-muted", '{"default":false}');
    localStorage.setItem("volume", "0.5");
    localStorage.setItem("video-quality", '{"default":"160p30"}');
  });
}

// Main Execution Flow
async function main() {
  onionProxy.startTorProxy(async () => {
    try {
      await discordClient.login(process.env.DISCORD_BOT_TOKEN);
      
      const { ip: torIP, timezone: torTimezone } = await getTorIdentity();
      console.log(chalk.green("🌐 Your Tor IP:"), torIP);
      console.log(chalk.blue("🕓 Timezone:"), torTimezone);

      const { browser, page } = await launchBrowser(torTimezone);
      setupDiscordHandlers(discordClient, page);

      // Initial navigation
      await page.goto("https://ip-scan.browserscan.net/sys/config/ip/get-visitor-ip", {
        waitUntil: "networkidle0",
        timeout: 0,
      });
    } catch (error) {
      console.error(chalk.red("❌ Initialization failed:"), error);
      process.exit(1);
    }
  });
}

// Start the application
main();