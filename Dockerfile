FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    sudo \
    curl \
    git \
    gnupg \
    wget \
    dpkg \
    libssl1.1 \
    libevent-2.1-7 \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    --no-install-recommends

# Install Chrome
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb || apt-get -fy install && \
    rm google-chrome-stable_current_amd64.deb

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Create non-root user and group
RUN useradd -m -s /bin/bash appuser

WORKDIR /usr/src/app

# Clone repo
RUN git clone https://github.com/WackyDawg/puppeteer-device

# Move into repo
WORKDIR /usr/src/app/puppeteer-device

# Create necessary directories and fix permissions
RUN mkdir -p public && chmod -R 777 public && \
    chmod +x /usr/src/app/puppeteer-device/onion-proxy/tor/bundle/linux/tor/tor && \
    chown -R appuser:appuser /usr/src/app/puppeteer-device
# RUN mkdir -p public && chmod -R 777 public

# Copy package.json and install dependencies as root (needed for npm install)
COPY package*.json ./
RUN npm install

# Copy rest of the code
COPY . .

# Make sure all files are owned by appuser
RUN chown -R appuser:appuser /usr/src/app/puppeteer-device

# Switch to non-root user
USER appuser

EXPOSE 7860

# CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 & export DISPLAY=:99 && node server.js"]
CMD ["node", "device.js"]
