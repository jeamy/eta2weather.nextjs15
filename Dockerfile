FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm --force install 

COPY . .

RUN npm run build 

EXPOSE 3000
ENV PORT 3000

CMD ["npm", "run", "start"]
