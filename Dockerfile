FROM node:20-alpine

WORKDIR /app

# 의존성 파일 복사 후 설치 (캐싱 최적화)
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY . .

# uploads 디렉토리 생성
RUN mkdir -p uploads logs

EXPOSE 3000

CMD ["node", "src/app.js"]
