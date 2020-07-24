# Inspired by: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

FROM node:10-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
RUN apk add --no-cache git
COPY package.json yarn.lock bower.json .bowerrc ./
RUN yarn

# Bundle app source
COPY . .

# Expose port 8080 and run app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["yarn", "start"]