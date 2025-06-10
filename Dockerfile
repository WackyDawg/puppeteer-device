FROM ubuntu:22.04

# Avoid interactive prompts during install
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
  curl gnupg ca-certificates \
  xvfb x11-utils x11-xserver-utils \
  fonts-liberation libappindicator3-1 libasound2 \
  libssl1.1 \
  dpkg \
  libevent-2.1-7 \
  libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \ 
  libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 libxss1 \
  libxtst6 lsb-release wget unzip \
  sudo xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Install Google Chrome manually
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
  && apt-get update && apt-get install -y ./google-chrome-stable_current_amd64.deb \
  && rm google-chrome-stable_current_amd64.deb

# Install Node.js (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs \
  && node -v && npm -v

# Set working directory
WORKDIR /usr/src/app

# Copy app files
COPY package*.json ./
RUN npm ci
COPY . .

# Add startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

 EXPOSE 5900

CMD ["/start.sh"]
