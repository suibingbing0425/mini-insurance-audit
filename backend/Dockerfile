FROM node:18-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package*.json ./
RUN npm install --omit=dev

# 再拷贝源码
COPY . .

# 入口脚本：等 DB 就绪 -> 建表 -> 种子 -> 启动
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
