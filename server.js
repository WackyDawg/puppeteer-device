import express from "express";
import { spawn } from "child_process";
import { Client, GatewayIntentBits } from "discord.js";
import multer from "multer";
import fs from "fs/promises";

const app = express();
const upload = multer({ dest: "public/" });
const PORT = 4000;

let botProcess = null;

app.get("/", (req, res) => {
  res.json({
    message: "Server is running!",
    status: 200,
    timestamp: new Date().toISOString(),
  });
});

app.get("/hello", (req, res) => {
  res.send("Restarting Device in 5 seconds...");

  setTimeout(() => {
    console.log("Starting the application after 5 seconds...");

    if (botProcess) {
      console.log("bot.js is already running.");
      return;
    }

    botProcess = spawn("node", ["device.js"], {
      stdio: "inherit",
    });

    botProcess.on("exit", (code) => {
      console.log(`bot.js exited with code ${code}`);
      botProcess = null;
    });
  }, 5000);
});

app.get("/start-12", (req, res) => {
  if (botProcess) {
    return res.send("bot.js is already running.");
  }

  res.send("Starting Device in 15 seconds...");

  setTimeout(() => {
    console.log("Starting the device after 15 seconds...");

    botProcess = spawn("node", ["device.js"], {
      stdio: "inherit",
    });

    botProcess.on("exit", (code) => {
      console.log(`bot.js exited with code ${code}`);
      botProcess = null;
    });
  }, 15000);
});

app.get("/shutdown-12", (req, res) => {
  if (!botProcess) {
    return res.send("bot.js is not running.");
  }

  res.send("Shutting down device in 15 seconds...");

  setTimeout(() => {
    console.log("Shutting down the device...");
    botProcess.kill("SIGTERM");
    botProcess = null;
  }, 15000);
});

app.post("/upl-profile", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No Profile uploaded.");
      }
  
      const originalName = req.file.originalname;
      const tempPath = req.file.path;
      const targetPath = `public/profile/${originalName}`;
  
      await fs.rename(tempPath, targetPath);
  
      console.log(`File uploaded and saved as ${originalName}`);
      res.send("Profile Successfully Updated. Device will restart in 15 seconds...");
  
      console.log("Preparing to restart device in 15 seconds...");
  
      setTimeout(() => {
        if (botProcess) {
          console.log("bot.js is running, shutting down...");
          botProcess.kill('SIGTERM');
          botProcess = null;
        } else {
          console.log("bot.js was not running.");
        }
  
        console.log("Starting bot.js...");
        botProcess = spawn('node', ['device.js'], {
          stdio: 'inherit',
        });
  
        botProcess.on('exit', (code) => {
          console.log(`bot.js exited with code ${code}`);
          botProcess = null;
        });
      }, 15000);
  
    } catch (err) {
      console.error("Upload error:", err);
      if (!res.headersSent) {
        res.status(500).send("Failed to upload file.");
      }
    }
  });
  
  

app.post("/update-cookie", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const originalName = req.file.originalname;
    const tempPath = req.file.path;
    const targetPath = `public/cookies/${originalName}`;

    await fs.rename(tempPath, targetPath);

    console.log(`File uploaded and saved as ${originalName}`);
    res.send(`Cookies Successfully Updated`);
  } catch (error) {
    console.error("Upload error:", err);
    res.status(500).send("Failed to upload file.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
