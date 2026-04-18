# Server Deploy Steps

## 目标

在同一个 VPS、同一个公网 IP 下，让两个网页同时存在：

- 旧蝴蝶网页
  - `http://你的IP/`
- 新智能巡拢家居机器人网页
  - `http://你的IP/sr/`

同时避免接口冲突：

- 旧项目接口
  - `/api/openclaw/`
- 新项目接口
  - `/api/sr/openclaw/`

## 一、服务器目录建议

建议目录：

```text
/home/deploy/Mechanical-Design-Competition
/home/deploy/sr
```

其中：

- 旧项目继续保留在原目录
- 新项目单独放到 `/home/deploy/sr`

## 二、把本地项目推到 GitHub

先在本地确认 `sr` 仓库已经提交并推送。

## 三、服务器拉取新项目

在服务器执行：

```bash
cd /home/deploy
git clone 你的sr仓库地址 sr
cd /home/deploy/sr/web-part/web-ui
npm install
cd app
npm install
npm run build
```

## 四、启动 webhook

在服务器执行：

```bash
cd /home/deploy/sr/web-part/web-ui
export WEBHOOK_SECRET='你自己的secret'
export WEBHOOK_PATH='/sr-webhook'
export REPO_DIR='/home/deploy/sr'
export DEPLOY_BRANCH='main'
export GIT_REMOTE='origin'
export POST_DEPLOY_COMMAND='npm --prefix web-part/web-ui install && npm --prefix web-part/web-ui/app install && npm --prefix web-part/web-ui/app run build && pm2 restart sr-openclaw --update-env && pm2 restart sr-webhook --update-env'
pm2 start webhook.js --name sr-webhook
pm2 save
```

默认监听：

- `127.0.0.1:9010`
- 路径：`/sr-webhook`

## 五、启动独立 OpenClaw

在服务器执行：

```bash
cd /home/deploy/sr/web-part/web-ui
export OPENCLAW_HOST='127.0.0.1'
export OPENCLAW_PORT='9012'
export OPENCLAW_PROVIDER='openai'
export OPENCLAW_ENDPOINT='https://api.openai.com/v1'
export OPENCLAW_MODEL='gpt-5.4'
export OPENCLAW_API_KEY='你的key'
export OPENCLAW_EXECUTOR_MODE='queue'
export OPENCLAW_DEVICE_ID='sr-robot-01'
export OPENCLAW_DEVICE_TOKEN='你自己的设备token'
pm2 start openclaw-server.js --name sr-openclaw
pm2 save
```

默认监听：

- `127.0.0.1:9012`

## 六、nginx 配置

编辑你当前站点配置，例如：

```bash
nano /etc/nginx/sites-available/robot-web
```

核心思路是：

- `/` 继续给旧站
- `/sr/` 给新站
- `/api/openclaw/` 给旧接口
- `/api/sr/openclaw/` 给新网页自己的 OpenClaw
- `/sr-webhook` 给新网页自己的自动部署

可以参考：

- `web-ui/deploy.nginx.example.conf`

如果你是同一个 server 块里追加，核心片段如下：

```nginx
location /sr/ {
    alias /home/deploy/sr/web-part/web-ui/app/dist/;
    try_files $uri $uri/ /sr/index.html;
}

location /api/sr/openclaw/ {
    proxy_pass http://127.0.0.1:9012/api/openclaw/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /sr-webhook {
    proxy_pass http://127.0.0.1:9010/sr-webhook;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

改完执行：

```bash
nginx -t
systemctl reload nginx
```

## 七、Cloudflare Worker + R2

如果要给新网页单独资产桶，在本地或服务器执行：

```bash
cd /home/deploy/sr/web-part/web-ui
npx wrangler r2 bucket create smart-gathering-assets
npm run cf:deploy
```

然后把生成出来的 Worker 地址，写进：

- `app/public/file-api-config.js`

例如：

```js
window.FILE_API_ENDPOINT = 'https://smart-gathering-assets-api.xxx.workers.dev';
```

改完重新构建：

```bash
cd /home/deploy/sr/web-part/web-ui/app
npm run build
```

## 八、GitHub 自动更新

在 GitHub 仓库 webhook 里配置：

- Payload URL:
  - `http://你的IP/sr-webhook`
- Content type:
  - `application/json`
- Secret:
  - 和 `WEBHOOK_SECRET` 一致

## 九、部署完成后访问

访问地址应为：

- 旧站
  - `http://你的IP/`
- 新站
  - `http://你的IP/sr/`

## 十、当前最稳的顺序

1. 先把 `/sr/` 静态页挂出来
2. 再确认 `/api/sr/openclaw/status` 能返回
3. 再测试网页任务输入
4. 再确认 `/sr-webhook` 已能收 GitHub push
5. 最后再加 Worker/R2 资产链路
