FROM node:16-slim

# Application directory
WORKDIR /usr/src/zerda

# Copy over relevant source files (see .dockerignore)
COPY . ./

# Set up project
RUN npm ci

# Expose database volume (Keep in sync with docker-compose.yml)
VOLUME /var/database
ENV ZERDA_DATABASE=/var/database/zerda.sqlite3

# Need to run migration at startup so volume is mounted and available
CMD [ "bash", "-c", "npm run knex migrate:latest && npm run start" ]

