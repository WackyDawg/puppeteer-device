FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    wget \
    dpkg \
    libssl1.1 \
    libevent-2.1-7 \
    ca-certificates

# Install Node.js 16
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "test.js"]
