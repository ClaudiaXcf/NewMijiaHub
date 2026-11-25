# 部署文档

从「本机跑起来」到「放在服务器上长期运行」的完整说明。读完按需挑一种方式即可。

- [0. 前置条件](#0-前置条件)
- [1. 本机运行](#1-本机运行)
- [2. 常驻运行：systemd（Linux）](#2-常驻运行systemdlinux)
- [3. 常驻运行：pm2（跨平台）](#3-常驻运行pm2跨平台)
- [4. 容器部署：Docker / Compose](#4-容器部署docker--compose)
- [5. 反向代理与 HTTPS](#5-反向代理与-https)
- [6. 环境变量](#6-环境变量)
- [7. 数据与备份](#7-数据与备份)
- [8. 安全清单](#8-安全清单)
- [9. 升级与卸载](#9-升级与卸载)
- [10. 排错](#10-排错)

---

## 0. 前置条件

| 项 | 要求 |
|---|---|
| Node.js | **≥ 18**（用到了内置 `fetch`；容器镜像用 `node:20-alpine`） |
| 依赖 | **无**。克隆下来就能跑，不需要 `npm install` |
| 系统 | Linux / macOS / Windows 均可；Windows 建议 PowerShell 或 Git Bash |
| 磁盘 | 源码 < 1 MB；凭据文件 < 1 KB |
| 内存 | 常驻约 40–60 MB |
| 网络 | 需要能访问 `api.io.mi.com`、`account.xiaomi.com`（扫码登录与设备控制） |

```bash
git clone https://github.com/ClaudiaXcf/NewMijiaHub.git
cd NewMijiaHub
node -v      # 确认 >= 18
```

---

## 1. 本机运行

```bash
node server.js
#   ➜  本机访问   http://127.0.0.1:8899/
```

不带任何登录信息启动时就是**演示模式**：设备、房间、状态全部本地虚构，
开关、滑杆、倒计时、播放进度都有模拟，不联网也能用。

要控制真实设备：侧栏「小米账号」→「扫码登录」→ 手机米家 App 扫一扫确认。
成功后设备列表来自你的账号，凭据写入 `data/credentials.json`。

> **只想演示给人看**：直接双击 `public/index.html` 用 `file://` 打开即可，
> 纯静态、无登录入口、不连任何后端。

---

## 2. 常驻运行：systemd（Linux）

```bash
sudo useradd -r -s /usr/sbin/nologin mihome
sudo mkdir -p /opt/mihome && sudo chown mihome:mihome /opt/mihome
# 把代码放到 /opt/mihome（git clone 或 rsync）
sudo -u mihome git clone https://github.com/ClaudiaXcf/NewMijiaHub.git /opt/mihome
```

`/etc/systemd/system/mihome.service`：

```ini
[Unit]
Description=Mi Home Web
Documentation=https://github.com/ClaudiaXcf/NewMijiaHub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mihome
Group=mihome
WorkingDirectory=/opt/mihome
ExecStart=/usr/bin/node server.js
Environment=PORT=8899
Environment=HOST=127.0.0.1
Restart=on-failure
RestartSec=3

# 凭据文件默认 600，这里再收一道
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
# 只有凭据目录可写
ReadWritePaths=/opt/mihome/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mihome
sudo systemctl status mihome
journalctl -u mihome -f          # 看日志
```

`HOST=127.0.0.1` 表示只有本机能访问；要让同一网段的手机/平板访问，改成 `0.0.0.0`
（但**先读第 8 节安全清单**）。

---

## 3. 常驻运行：pm2（跨平台）

```bash
npm i -g pm2
PORT=8899 HOST=127.0.0.1 pm2 start server.js --name mihome
pm2 logs mihome
pm2 save
pm2 startup          # 按提示复制执行输出的那行命令，开机自启
```

Windows 上 pm2 需要在 PowerShell 里设置环境变量：

```powershell
$env:PORT="8899"; $env:HOST="127.0.0.1"; pm2 start server.js --name mihome
pm2 save
```

---

## 4. 容器部署：Docker / Compose

仓库自带 `Dockerfile`（多阶段不需要，零依赖直接复制源码）与 `docker-compose.yml`。

### Compose（推荐）

```bash
docker compose up -d --build
docker compose logs -f
```

默认行为：

- 端口只绑到宿主机回环 `127.0.0.1:8899`，公网访问必须经过反向代理；
- `./data` 挂载到容器 `/app/data`，容器重建不用重新扫码；
- 容器以非 root 用户 `node` 运行，根文件系统只读（`read_only: true`），凭据目录是唯一可写点。

要直接暴露到局域网，把 `docker-compose.yml` 里的端口改成 `"8899:8899"`。

> **凭据目录权限**：容器内以非 root 用户 `node`（uid 1000）运行，如果宿主机上的 `./data`
> 是 root 创建的，扫码后写入会失败。先建好目录并对齐属主：
>
> ```bash
> mkdir -p data && sudo chown -R 1000:1000 data
> ```
>
> 或者改用命名卷 `volumes: [mihome-data:/app/data]`，让 Docker 自己管理归属。

### 纯 docker

```bash
docker build -t mihome-web .
docker run -d --name mihome-web \
  -p 127.0.0.1:8899:8899 \
  -e PORT=8899 -e HOST=0.0.0.0 \
  -v "$PWD/data:/app/data" \
  --restart unless-stopped \
  mihome-web
```

> 容器里 `HOST` 必须是 `0.0.0.0`，否则端口映射进不去。

> 说明：容器方案按标准 `node:20-alpine` 编排（零依赖，无 `npm install` 步骤），
> 但作者本机没有安装 Docker，**镜像构建未做实际验证**。若遇到构建问题，欢迎提 issue。

---

## 5. 反向代理与 HTTPS

**强烈建议**：如果要从外网访问，前面必须有一层带身份验证的反向代理。
本项目自身没有登录鉴权，端口暴露给谁，谁就能控制你家的设备。

Nginx 示例（`/etc/nginx/conf.d/mihome.conf`）：

```nginx
server {
    listen 443 ssl http2;
    server_name mihome.example.com;

    ssl_certificate     /etc/letsencrypt/live/mihome.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mihome.example.com/privkey.pem;

    # 最低成本的访问控制：HTTP Basic Auth
    auth_basic           "Mi Home";
    auth_basic_user_file /etc/nginx/.htpasswd;   # htpasswd -c /etc/nginx/.htpasswd yourname

    location / {
        proxy_pass http://127.0.0.1:8899;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 扫码登录走 48 秒长轮询（/api/login/qr/wait），超时和缓冲都要放宽
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_buffering    off;
    }
}

server {
    listen 80;
    server_name mihome.example.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo htpasswd -c /etc/nginx/.htpasswd yourname
sudo nginx -t && sudo systemctl reload nginx
```

要点：

- `proxy_read_timeout` **必须大于 48s**，否则扫码时页面会一直转圈／报 504；
- `proxy_buffering off`，长轮询需要边收边转发；
- 只放开 443，8899 不要对公网开放（用防火墙挡掉）。

---

## 6. 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8899` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址。改成 `0.0.0.0` 才对其他机器可见，**先看安全清单** |

```bash
PORT=9000 HOST=0.0.0.0 node server.js
```

---

## 7. 数据与备份

唯一的持久化数据是 **`data/credentials.json`**：

```json
{
  "device_id": "…",
  "user_id": "…",
  "c_user_id": "…",
  "ssecurity": "…",
  "pass_token": "…",
  "service_token": "…"
}
```

- 文件权限 `600`，由服务自己创建，**不要提交到 Git**（`.gitignore` 已排除 `data/*`）；
- 备份：`cp data/credentials.json ~/mihome-cred.bak`（注意备份文件本身也要保密）；
- 迁移：把该文件拷到新机器的 `data/` 下即可，无需重新扫码；
- 失效：token 过期时服务会自动用 passToken 续期；续期也失败就重新扫码；
- 清除：侧栏「退出登录」，或直接删掉这个文件 —— 只影响本机，不影响手机端与云端。

浏览器侧的状态（卡片顺序、尺寸、图标、颜色、语言）存在 **localStorage**，
换浏览器会回到默认布局，与服务器无关。

---

## 8. 安全清单

按重要性排序，至少做到前三条：

- [ ] **不要直接暴露到公网**。默认 `HOST=127.0.0.1` 就是为此设计的。
- [ ] 必须远程访问时，套一层 **HTTPS + Basic Auth**（或 VPN / Tailscale / Cloudflare Access），并只放行 443。
- [ ] 确认 `data/credentials.json` 没有进仓库：
      `git ls-files | grep -i cred` 应该没有任何输出。
- [ ] 凭据文件权限保持 `600`，不要放进共享目录/网盘同步目录。
- [ ] 用防火墙限制 8899 只对本机开放：
      `sudo ufw deny 8899` 或 `iptables -A INPUT -p tcp --dport 8899 -j DROP`。
- [ ] 容器部署时保持 `read_only: true` 与 `no-new-privileges`，只挂载 `data/`。
- [ ] 定期 `git pull` 拿修复；本项目接口是逆向的，上游随时可能变。
- [ ] 用**自己的账号**登录，不要把凭据发给别人；泄露后立即在米家 App 里改密码并删除本机 `data/credentials.json`。

---

## 9. 升级与卸载

升级（源码部署）：

```bash
cd /opt/mihome
sudo -u mihome git pull
sudo systemctl restart mihome     # pm2: pm2 restart mihome
```

升级（容器）：

```bash
git pull
docker compose up -d --build
```

`data/` 是挂载卷，升级不会丢登录状态。

卸载：

```bash
sudo systemctl disable --now mihome && sudo rm /etc/systemd/system/mihome.service
rm -rf /opt/mihome            # 连同 data/credentials.json 一起删除
# 容器：docker compose down -v && docker rmi mihome-web:latest
```

---

## 10. 排错

| 现象 | 原因与处理 |
|---|---|
| `EADDRINUSE: 8899` | 端口被占用。`lsof -i :8899` / Windows `netstat -ano \| findstr 8899` 找到进程，或换 `PORT=9000` |
| 页面能开，但设备列表空、顶部显示「未登录」 | 正常：演示模式设备在内存里；云端模式需要先扫码。点侧栏「小米账号」 |
| 扫码后一直转圈 | 反代 `proxy_read_timeout` 小于 48s；或本机访问不到 `account.xiaomi.com` |
| `拉取设备失败：… Invalid param (code -8)` | `gspec` 单次 did 超过 50。当前版本已按 20 台分片；若是自己改的代码，检查分片逻辑 |
| 设备都在，但一个控件都没有 | spec 没解析出来。看日志里 `normalizeSpecs` 是否报错；`instances[did].instance` 需要 `JSON.parse` |
| 点开关提示「设备未确认」 | 设备异步执行，服务端在 2.6s 内没读到目标值。多为设备离线/信号差，稍后重试 |
| 点开关提示「设备离线」 | 设备真的不在线，先去米家 App 确认 |
| 新加的设备看不到 | spec 缓存 10 分钟（按 did 集合做 key）。重启服务或点「刷新设备」 |
| 控制台有 `fetch failed` | 后端没起来 / 端口不对；`file://` 打开时属正常（静态演示没有后端） |
| 换台电脑后布局全乱了 | 布局存在浏览器 localStorage，与账号无关，重新拖一次即可 |
| Windows 上局域网设备访问不到 | 防火墙拦了；`HOST=0.0.0.0` 并放行端口（同样注意安全清单） |

日志里带时间戳的行由服务端打印；前端报错看浏览器 DevTools Console，
报错文案已经中文化（如「下发失败：属性不存在」）。

---

## 附：一分钟自检

部署完想确认一切正常：

```bash
curl -s -o /dev/null -w "page=%{http_code}\n" http://127.0.0.1:8899/
curl -s http://127.0.0.1:8899/api/devices | head -c 200
node test/browser-smoke.js      # 22 项断言应全部通过
```

`page=200` + `/api/devices` 返回 JSON（未登录时是 `{"ok":false,"error":"未登录，请先扫码"}`）
就说明服务本身没问题，剩下的只是登录。
