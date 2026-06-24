# BleuLearn Sovereign Curriculum -- AvaBleu House HQ | 2026
#
# Coolify can auto-detect a plain Node.js app via Nixpacks without this
# file at all. This Dockerfile is provided anyway for certainty: it
# removes any ambiguity about Node version, build steps, or what gets
# copied into the image, rather than trusting an auto-detection step to
# guess correctly. Coolify uses a Dockerfile automatically if one is
# present at the repository root -- no extra configuration needed.

FROM node:20-slim

WORKDIR /app

# Install dependencies first (separate layer) so Docker can cache this
# step and skip reinstalling on every code change -- only re-runs when
# package.json actually changes.
COPY package.json ./
RUN npm install --omit=dev

# Now copy the rest of the application.
COPY . .

# Matches the PORT environment variable server.js reads, and what
# Coolify's "Port Exposes" field should be set to.
EXPOSE 3000

CMD ["npm", "start"]
