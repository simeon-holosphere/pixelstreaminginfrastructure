# Use the current Long Term Support (LTS) version of Node.js
FROM node:lts

# Install necessary tools
RUN apt-get update && apt-get install -y dos2unix

# Set up work directory
WORKDIR /app

# Copy all package.json files first
COPY package.json ./
COPY Common/package.json ./Common/
COPY Signalling/package.json ./Signalling/
COPY SignallingWebServer/package.json ./SignallingWebServer/

# Install root dependencies
RUN npm install

# Copy source files
COPY Common ./Common
COPY Signalling ./Signalling
COPY SignallingWebServer ./SignallingWebServer
COPY Frontend ./Frontend

# Install and build Common
WORKDIR /app/Common
RUN npm install
RUN npm run build

# Install and build Signalling
WORKDIR /app/Signalling
RUN npm install
RUN npm run build:cjs
RUN npm run build:esm

# Fix line endings and set permissions for scripts
WORKDIR /app/SignallingWebServer
RUN find platform_scripts/bash/ -type f -name "*.sh" -exec dos2unix {} \; && \
    find platform_scripts/bash/ -type f -name "*.sh" -exec chmod +x {} \;

# Install SignallingWebServer dependencies and run setup
RUN npm install
# RUN npm install @epicgames-ps/lib-pixelstreamingsignalling-ue5.5
RUN ./platform_scripts/bash/setup.sh --build

# Link local dependencies
RUN npm link ../Common
RUN npm link ../Signalling

# Now run rebuild
RUN npm run rebuild

# Expose ports
EXPOSE 80 443
EXPOSE 8081-8091
EXPOSE 8888
EXPOSE 8888/udp
EXPOSE 8889
EXPOSE 19302
EXPOSE 3478-3479

ENTRYPOINT ["bash", "platform_scripts/bash/start.sh", "--nosudo"]