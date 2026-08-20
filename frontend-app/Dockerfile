# frontend-app — Railway static host for the CRA web app
# Root Directory in Railway should be `frontend-app` (this folder).

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# CRA bakes REACT_APP_* in at build time. Set these on the Railway service
# and mark them available at build time (or pass as Docker build args).
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_VAPID_PUBLIC_KEY
ARG REACT_APP_FRONTEND_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_VAPID_PUBLIC_KEY=$REACT_APP_VAPID_PUBLIC_KEY
ENV REACT_APP_FRONTEND_URL=$REACT_APP_FRONTEND_URL

RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve@14.2.4

COPY --from=build /app/build ./build

ENV PORT=3000
EXPOSE 3000

# -s: SPA fallback so React Router deep links work
CMD ["sh", "-c", "serve -s build -l tcp://0.0.0.0:${PORT}"]
