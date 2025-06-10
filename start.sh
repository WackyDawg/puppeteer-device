#!/bin/bash

# Start a virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &

# Give Xvfb a moment to start
sleep 2

# Start your Node.js bot
node server.js
