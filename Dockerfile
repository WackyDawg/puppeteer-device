FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all other dependencies
RUN apt-get update && apt-get install -y \
  curl gnupg ca-certificates \
  xvfb x11-utils x11-xserver-utils \
  fonts-liberation libappindicator3-1 libasound2 \
  dpkg libevent-2.1-7 \
  libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 libxss1 \
  libxtst6 lsb-release wget unzip sudo xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
  && apt-get update && apt-get install -y ./google-chrome-stable_current_amd64.deb \
  && rm google-chrome-stable_current_amd64.deb

# Manually install libssl1.1
RUN wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl1.1/libssl1.1_1.1.1f-1ubuntu2.19_amd64.deb \
  && dpkg -i libssl1.1_1.1.1f-1ubuntu2.19_amd64.deb \
  && rm libssl1.1_1.1.1f-1ubuntu2.19_amd64.deb

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs \
  && node -v && npm -v

# Set up app
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 5900
CMD ["/start.sh"]
