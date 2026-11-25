# 米家 Web 版：零依赖 Node 服务，镜像只装运行时
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8899 \
    HOST=0.0.0.0

WORKDIR /app

# 零第三方依赖，无需 npm install，只复制源码
COPY package.json server.js ./
COPY lib ./lib
COPY public ./public

# 凭据目录：以 volume 挂载，不要打进镜像
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 8899
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8899)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
