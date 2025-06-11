import { connect } from "puppeteer-real-browser";
import { newInjectedPage } from "fingerprint-injector";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import chalk from "chalk";
import onionProxy from "./onion-proxy/app.js";
import FormData from "form-data";
import axios from "axios";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;

// Configuration
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
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--ignore-certificate-errors",
    "--ignore-certificate-errors-spki-list",
    "--disable-gpu",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
    "--disable-speech-api",
    //"--disable-background-networking", // Disable several subsystems which run network requests in the background. This is for use 									  // when doing network performance testing to avoid noise in the measurements. ↪
    //"--disable-background-timer-throttling", // Disable task throttling of timer tasks from background pages. ↪
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-domain-reliability",
    "--disable-extensions",
    "--disable-features=AudioServiceOutOfProcess",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-notifications",
    "--disable-offer-store-unmasked-wallet-cards",
    "--disable-popup-blocking",
    "--disable-print-preview",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-setuid-sandbox",
    "--disable-sync",
    "--hide-scrollbars",
    "--ignore-gpu-blacklist",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-pings",
    "--no-sandbox",
    "--no-zygote",
    "--password-store=basic",
    "--use-gl=swiftshader",
    "--use-mock-keychain",
  ],
  TOR_CHECK_URL: "https://ip-scan.browserscan.net/sys/config/ip/get-visitor-ip",
};

// Utilities
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

// Discord Client
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

// Browser Initialization
async function launchBrowser(timezone) {
  const { browser } = await connect({
    args: CONFIG.BROWSER_ARGS,
    headless: true,
    turnstile: true,
  });

  const page = await newInjectedPage(browser, {
    fingerprintOptions: {
      devices: [process.env.devices],
      operatingSystems: [process.env.operatingSystems],
    },
  });

  await page.emulateTimezone(timezone);
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
      }
    } catch (error) {
      console.error(`Command error [${command}]:`, error);
      message.reply(`❌ Command failed: ${error.message}`);
    }
  });
}

// Command Implementations
async function handleGoto(message, page, url) {
  if (!url) return message.reply("⚠️ Please provide a URL");

  await page.bringToFront();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  await message.reply(`✅ Navigated to ${url}`);

  await page.evaluate(() => {
    localStorage.setItem("mature", "true");
    localStorage.setItem("video-muted", '{"default":false}');
    localStorage.setItem("volume", "0.5");
  });

  try {
    const acceptSelector = 'button[data-a-target="consent-banner-accept"]';
    if (await page.$(acceptSelector)) {
      await page.click(acceptSelector);
      console.log("✅ Accepted cookies");
    }
  } catch (err) {
    console.warn("⚠️ Cookie handling skipped");
  }
}

async function handleScreenshot(page) {
  await page.bringToFront();
  const screenshotPath = `screenshot-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const form = new FormData();
  form.append("file", fs.createReadStream(screenshotPath));

  try {
    await axios.post(WEBHOOK_URL, form, { headers: form.getHeaders() });
    console.log("✅ Screenshot sent to Discord");
  } catch (err) {
    console.error("❌ Discord upload failed:", err.message);
  } finally {
    fs.unlinkSync(screenshotPath);
  }
}

async function handleClick(message, page, selector) {
  if (!selector) return message.reply("⚠️ Please provide a selector");
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  await message.reply(`✅ Clicked ${selector}`);
}

async function handleType(message, page, selector, text) {
  if (!selector || !text) {
    return message.reply("⚠️ Please provide both selector and text");
  }
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.type(selector, text);
  await message.reply(`✅ Typed "${text}" into ${selector}`);
}

async function handleTwitchFollow(message, page, url) {
  if (!url?.includes("twitch.tv")) {
    return message.reply("⚠️ Invalid Twitch URL");
  }
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.click('button[data-a-target="follow-button"]');
  await message.reply(`✅ Followed ${url}`);
}

async function handleTwitchStream(message, page, url) {
  if (!url?.includes("twitch.tv")) {
    return message.reply("⚠️ Invalid Twitch URL");
  }
  await page.goto(url, { waitUntil: "networkidle0" });

  try {
    if (await page.$('button[data-a-target="consent-banner-accept"]')) {
      await page.click('button[data-a-target="consent-banner-accept"]');
    }
  } catch {}

  await page.evaluate(() => {
    localStorage.setItem("mature", "true");
    localStorage.setItem("video-muted", '{"default":false}');
    localStorage.setItem("volume", "0.5");
  });
  await message.reply(`✅ Watching stream: ${url}`);
}

// Main Application
async function main() {
  onionProxy.startTorProxy(async () => {
    try {
      const token = process.env.DISCORD_BOT_TOKEN.replace(/\+/g, '');
      await discordClient.login(token);
      const { ip, timezone } = await getTorIdentity();
      console.log(chalk.green("🌐 Tor IP:"), ip);
      console.log(chalk.blue("🕓 Timezone:"), timezone);

      const { page } = await launchBrowser(timezone);
      setupDiscordHandlers(discordClient, page);

      // Initial test page
      await page.goto(CONFIG.TOR_CHECK_URL, { waitUntil: "networkidle0" });
    } catch (error) {
      console.error(chalk.red("❌ Startup failed:"), error);
      process.exit(1);
    }
  });
}

main();
