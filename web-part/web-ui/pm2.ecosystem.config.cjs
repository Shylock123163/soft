module.exports = {
  apps: [
    {
      name: 'sr-openclaw',
      script: './openclaw-server.js',
      cwd: '/home/deploy/sr/web-part/web-ui',
      env: {
        OPENCLAW_HOST: '127.0.0.1',
        OPENCLAW_PORT: '9012',
        OPENCLAW_PROVIDER: 'openai',
        OPENCLAW_ENDPOINT: 'https://api.openai.com/v1',
        OPENCLAW_MODEL: 'gpt-5.4',
        OPENCLAW_EXECUTOR_MODE: 'queue',
        OPENCLAW_DEVICE_ID: 'sr-robot-01',
        OPENCLAW_AUTO_EXECUTE: 'false'
      }
    },
    {
      name: 'sr-webhook',
      script: './webhook.js',
      cwd: '/home/deploy/sr/web-part/web-ui',
      env: {
        HOST: '127.0.0.1',
        PORT: '9010',
        WEBHOOK_PATH: '/sr-webhook',
        REPO_DIR: '/home/deploy/sr',
        DEPLOY_BRANCH: 'main',
        GIT_REMOTE: 'origin',
        POST_DEPLOY_COMMAND:
          'npm --prefix web-part/web-ui ci && npm --prefix web-part/web-ui/app ci && NODE_OPTIONS=--max-old-space-size=1536 npm --prefix web-part/web-ui/app run build && pm2 restart sr-openclaw --update-env && pm2 restart sr-webhook --update-env'
      }
    }
  ]
};
