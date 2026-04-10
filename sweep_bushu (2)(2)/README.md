# sweep_bushu

鲁班猫部署包，作用是:

- 开机自启动网页检测
- 实时判断前方是否有需要清理的杂物
- 通过串口把稳定结果实时发给 STM32F103ZET6 `USART3`
- 使用 ROI 限制前方有效区域
- 使用卡尔曼滤波 + 滞回阈值提高稳定性
- 后续可直接替换模型文件

## 目录

```text
sweep_bushu/
├─ test2-rk3588.rknn
├─ deploy_web_detect.py
├─ config.yaml
├─ start_web_detect.sh
├─ install_autostart.sh
├─ requirements.txt
├─ stm32_protocol_example.c
└─ README.md
```

## 1. 放到鲁班猫

把整个 `sweep_bushu` 文件夹传到鲁班猫，例如:

```bash
/home/cat/sweep_bushu
```

## 2. 安装依赖

```bash
cd /home/cat/sweep_bushu
python3 -m pip install -r requirements.txt
```

## 3. 通信基准

本工程的通信风格参考这个桥接程序:

- [main.c](C:\Users\zbl\Desktop\robot_vision\serial_comm\stm32_bridge_c8_usart2\User\main.c)
- [usart.c](C:\Users\zbl\Desktop\robot_vision\serial_comm\stm32_bridge_c8_usart2\Hardware\usart.c)
- [usart.h](C:\Users\zbl\Desktop\robot_vision\serial_comm\stm32_bridge_c8_usart2\Hardware\usart.h)

关键参数:

- STM32 芯片: `STM32F103ZET6`
- 电控联动目标串口: `USART3`
- STM32 `USART3` 重映射引脚: `PD9 = RX`, `PD8 = TX`
- 波特率: `115200`
- 格式: `8N1`
- Python 侧默认优先尝试 `USART3` 对应的 Linux 串口设备

这意味着:

- 如果 STM32 还烧录的是这个桥接程序，那么鲁班猫发出的协议字符串会直接透传到电脑串口
- 你可以先在电脑端确认收到 `$SWEEP,...`，再让电控把同样的协议接进去

## 4. 接线

推荐先按单向通信接:

- 鲁班猫 TX -> STM32 USART3 RX `PD9`
- 鲁班猫 GND -> STM32 GND

如果还要回传调试信息，再加:

- STM32 USART3 TX `PD8` -> 鲁班猫 RX

注意:

- 一定是 `TX 对 RX`
- 共地必须接
- 使用 `3.3V TTL` 电平，不要直接接 `RS232`

如果你现在做正式电控联动，当前最小接线就是:

- 鲁班猫 TXD -> STM32 `PD9`
- 鲁班猫 GND -> STM32 `GND`
- 只做单向控制时，不需要接 `PD8`

## 5. 手动先跑通

```bash
cd /home/cat/sweep_bushu
bash start_web_detect.sh
```

浏览器打开:

```text
http://鲁班猫IP:5007
```

网页里除了画面，还能看到:

- 当前稳定结果
- 是否需要清理
- 串口端口
- 串口连接状态
- 最后一条发送内容

## 6. 串口协议

默认发送协议是:

```text
$SWEEP,1,823,801,823,CLUTTER
```

字段说明:

1. `$SWEEP` 固定帧头
2. `1/0` 是否有杂物
3. `823` 滤波后的 clutter 概率，范围 `0~1000`
4. `801` 原始 clutter 概率，范围 `0~1000`
5. `823` 最终判定置信度，范围 `0~1000`
6. `CLUTTER/CLEAN/UNKNOWN` 最终状态

如果 STM32 端只关心是否前进，最少只解析第 2 个字段即可。

示例:

- `$SWEEP,1,823,801,823,CLUTTER`
- `$SWEEP,0,112,101,888,CLEAN`

这些都是 `ASCII + CRLF` 文本帧。

仓库里已经放了示例解析文件:

- [stm32_protocol_example.c](C:\Users\zbl\Desktop\robot_vision\new_lable\sweep_bushu\stm32_protocol_example.c)

## 7. 线程结构

当前程序内部是两条独立线程:

- 视觉线程: 摄像头采集、ROI、推理、网页显示
- 串口线程: 只消费视觉线程投递的最新结果，然后发串口

两条线程通过“最新结果队列”解耦:

- 串口异常不会把网页线程拖死
- 网页刷新也不会影响串口发送
- 后续如果你要改联动逻辑，优先只改 `deploy_web_detect.py`

## 8. 配置串口

当前 `deploy_web_detect.py` 已经默认优先按 `USART3` 选口。

如果 `auto` 选错口，直接改成固定串口，例如:

```yaml
serial:
  enabled: true
  port: /dev/ttyS3
  baud: 115200
```

在 [config.yaml](C:\Users\zbl\Desktop\robot_vision\new_lable\sweep_bushu\config.yaml) 里看这段:

```yaml
serial:
  enabled: true
  port: auto
  baud: 115200
```

如果 `auto` 选错口，直接改成固定串口，例如:

```yaml
serial:
  enabled: true
  port: /dev/ttyUSB0
  baud: 115200
```

或者 USB-TTL 联调时:

```yaml
serial:
  enabled: true
  port: /dev/ttyUSB0
  baud: 115200
```

## 9. 开机自启动

```bash
cd /home/cat/sweep_bushu
chmod +x start_web_detect.sh install_autostart.sh
bash install_autostart.sh
```

查看状态:

```bash
systemctl status sweep-bushu.service
```

查看日志:

```bash
tail -f /home/cat/sweep_bushu/logs/service.log
```

## 10. 换模型

当前默认已经切到:

```yaml
model:
  path: ./test2-rk3588.rknn
```

如果以后换模型，优先只改 `config.yaml` 里的:

```yaml
model:
  path: ./你的新模型文件
  clutter_class_name: clutter
```

支持思路:

- `.rknn` 直接部署
- `.pt` / `.onnx` 也可以继续复用同一套脚本

如果新模型类别名不是 `clutter`，把 `clutter_class_name` 一起改掉。

## 11. 当前稳定策略

- 先按 ROI 裁剪，只看机器人正前方
- 再做分类推理
- 对 `clutter` 概率做一维卡尔曼滤波
- 用双阈值防抖:
  - `threshold_on=0.60`
  - `threshold_off=0.40`

这样可以减少一闪一闪的误判。

## 12. 网页里能做什么

- 实时看摄像头画面
- 拖动 ROI 框
- 手动改 `x1 y1 x2 y2`
- `仅更新`: 只改当前运行参数
- `保存到配置`: 直接写回 `config.yaml`
- 实时查看串口发送状态

## 13. 给队友的联调顺序

1. 先只开网页，确认视觉判断正常。
2. 再接 STM32，只看网页里的 `串口状态` 是否 `CONNECTED`。
3. STM32 电控只需要解析第 2 个字段 `1/0`。
4. 最后再把这个字段接进运动控制逻辑。

## 14. 建议

第一次部署先手动运行确认:

- 摄像头能打开
- 页面能显示
- 模型能正常推理
- `clean / clutter` 判断基本正常
- 串口状态显示正常
- STM32 USART3 能收到连续状态帧

## 15. 以后上传建议

以后如果只是改联动逻辑、线程逻辑、串口协议，优先只上传这一个文件:

- [deploy_web_detect.py](C:\Users\zbl\Desktop\robot_vision\new_lable\sweep_bushu\deploy_web_detect.py)

确认无误后再执行开机自启动。
