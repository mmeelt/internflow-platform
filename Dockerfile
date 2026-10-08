FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8081
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S internflow && adduser -S internflow -G internflow
COPY --from=build --chown=internflow:internflow /app/public ./public
COPY --from=build --chown=internflow:internflow /app/.next/standalone ./
COPY --from=build --chown=internflow:internflow /app/.next/static ./.next/static
USER internflow
EXPOSE 3000
CMD ["node", "server.js"]
