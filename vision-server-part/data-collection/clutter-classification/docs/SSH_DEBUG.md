# SSH 调试说明

## 为什么用 SSH

现场没有实验室网络时，不用 Jupyter 也能调试。

只要电脑和鲁班猫在同一个局域网，就可以:

- 远程开终端
- 看日志
- 启动采集脚本
- 传文件
- 浏览器访问鲁班猫网页

## 鲁班猫端

第一次在鲁班猫执行:

```bash
cd /home/cat/new_lable
bash lubancat/setup_lubancat_ssh.sh
```

查看 IP:

```bash
hostname -I
```

## Windows 电脑端连接

PowerShell 里执行:

```powershell
ssh cat@192.168.xxx.xxx
```

如果要把项目传到鲁班猫:

```powershell
scp -r C:\Users\zbl\Desktop\robot_vision\new_lable cat@192.168.xxx.xxx:/home/cat/
```

## 常用调试命令

连上后常用:

```bash
cd /home/cat/new_lable
ls
python3 --version
python3 lubancat/collect_dataset_web.py --camera 0 --port 5004 --save-root dataset/raw
```

## 浏览器访问

如果鲁班猫采集脚本已经启动，电脑浏览器直接打开:

```text
http://鲁班猫IP:5004
```

## 比 Jupyter 更适合现场的地方

- 不依赖实验室现成 Jupyter
- 只要同网段就能连
- 网络要求低
- 更适合跑后台脚本和看终端日志
