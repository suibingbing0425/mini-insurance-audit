#!/bin/sh
# 容器启动入口：等待 MySQL -> 同步表结构 -> 灌种子/知识库 -> 启动服务
set -e

echo "等待 MySQL 就绪..."
until node -e "require('./src/models').sequelize.authenticate().then(()=>process.exit(0)).catch(()=>process.exit(1))"; do
  echo "  MySQL 未就绪，2 秒后重试..."
  sleep 2
done

echo "迁移数据表结构（sequelize-cli migration）..."
npx sequelize db:migrate || node_modules/.bin/sequelize db:migrate

echo "初始化种子数据（用户/药品/规则）..."
node src/seeders/seed.js

echo "迁移医保政策知识库..."
node scripts/migrate-rule-knowledge.js || echo "（知识库已迁移，跳过）"

echo "启动后端服务..."
exec node src/app.js
