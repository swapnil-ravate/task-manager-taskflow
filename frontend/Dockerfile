# Stage 1 - Build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 - Serve
FROM nginx:alpine
# Note: Using dist instead of build as this is a Vite project
COPY --from=build /app/dist /usr/share/nginx/html
# Note: This requires nginx/ folder to be in the build context
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
