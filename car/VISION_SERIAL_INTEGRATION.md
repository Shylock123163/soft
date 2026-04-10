# 电控视觉串口接入说明

本文档说明 `car` 工程中“鲁班猫/上位机视觉结果 -> STM32 电控状态机”的接入方式，方便以后替换模型或更换上位机程序时复用现有电控逻辑。

## 1. 总体功能

当前电控工程已经具备一条完整链路：

```text
鲁班猫/上位机模型输出
    -> 串口文本协议 $SWEEP,...
    -> STM32 USART3 接收
    -> 解析为视觉状态变量
    -> 状态机根据视觉结果执行搜索、锁定、前进、抓取、退出等动作
```

这意味着：

- 电控并不依赖具体模型框架
- 电控也不关心你是 RKNN、YOLO、分类模型还是别的推理引擎
- 只要上位机最终仍然发同样格式的串口文本，STM32 就可以继续工作

换模型时，优先保证“串口输出协议不变”，这样通常**不需要改 STM32 电控代码**。

---

## 2. 关键文件

### 2.1 外设初始化
- `Core/Src/main.c`

关键点：
- 系统启动后会初始化多个 UART
- 视觉串口依赖 `MX_USART3_UART_Init()`

相关位置：
- `Core/Src/main.c:197`
- `Core/Src/main.c:199`

说明：
- `USART1` 主要用于 `printf` 调试输出到电脑
- `USART3` 才是视觉结果输入口

### 2.2 串口配置
- `Core/Src/usart.c`
- `Core/Inc/usart.h`

关键点：
- `huart3.Instance = USART3`
- 波特率 `115200`
- 格式 `8N1`
- 开启了 `USART3` 中断
- 启用了 `USART3` 重映射

相关位置：
- `Core/Src/usart.c:171`
- `Core/Src/usart.c:181`
- `Core/Src/usart.c:327`
- `Core/Src/usart.c:341`
- `Core/Src/usart.c:344`

### 2.3 视觉协议接收与解析
- `Core/Src/freertos.c`

关键函数：
- `StartCommTask()`
- `Robot_VisionRxStart()`
- `Robot_VisionProtocol_Poll()`
- `HAL_UARTEx_RxEventCallback()`
- `VisionDetectedStable()`
- `Robot_EstimateForwardMm()`

相关位置：
- `Core/Src/freertos.c:749`
- `Core/Src/freertos.c:907`
- `Core/Src/freertos.c:939`
- `Core/Src/freertos.c:1153`
- `Core/Src/freertos.c:772`
- `Core/Src/freertos.c:819`

### 2.4 全局状态变量与状态机枚举
- `Core/Inc/robot.h`

关键内容：
- 状态机枚举 `RobotState_t`
- 视觉相关变量：
  - `g_vision_detected`
  - `g_vision_position`
  - `g_vision_distance`
  - `g_vision_smooth`
  - `g_vision_raw`
  - `g_vision_decision`

相关位置：
- `Core/Inc/robot.h:7`
- `Core/Inc/robot.h:40`

---

## 3. 串口硬件配置

当前视觉输入固定走 `USART3`。

### 3.1 参数
- 串口：`USART3`
- 波特率：`115200`
- 数据位：`8`
- 校验位：`None`
- 停止位：`1`

### 3.2 引脚
当前代码启用了 `USART3` 重映射：

- `PD8  -> USART3_TX`
- `PD9  -> USART3_RX`

相关代码：
- `Core/Src/usart.c:327`
- `Core/Src/usart.c:341`

### 3.3 接线方式
如果是鲁班猫给 STM32 发视觉结果，至少接：

- 鲁班猫 `TX` -> STM32 `PD9`
- 鲁班猫 `GND` -> STM32 `GND`

如果还想让 STM32 回传信息给鲁班猫，再接：

- STM32 `PD8` -> 鲁班猫 `RX`

注意：
- 必须 `TX -> RX`
- 必须共地
- 必须使用 `3.3V TTL` 电平
- 不要直接接 `RS232`

---

## 4. 当前串口协议

### 4.1 帧格式
当前电控接收的是一行 ASCII 文本：

```text
$SWEEP,1,823,801,823,CLUTTER\r\n
```

### 4.2 字段定义
字段顺序如下：

1. `$SWEEP`：固定帧头
2. `1/0`：是否检测到目标/杂物
3. `smooth`：滤波后的概率或强度，范围通常 `0~1000`
4. `raw`：原始概率或强度，范围通常 `0~1000`
5. `decision`：最终判定置信度，范围通常 `0~1000`
6. `CLUTTER/CLEAN/...`：状态字符串

### 4.3 STM32 当前真正使用了哪些字段
在 `Core/Src/freertos.c:980-1017` 中：

- 校验了帧头 `$SWEEP`
- 解析了：
  - `flag`
  - `smooth`
  - `raw`
  - `decision`
- **没有真正依赖最后的状态字符串做逻辑判断**

也就是说：

当前状态机主要依赖的是：

- `flag`
- `smooth`
- `raw`
- `decision`

如果你以后更换模型，只要还能输出这几个字段，最后的文本状态字段甚至可以先不改。

---

## 5. 电控接收链路

### 5.1 启动接收
在通信任务里启动视觉串口接收：
- `Core/Src/freertos.c:754`

```c
Robot_VisionRxStart();
```

### 5.2 开启空闲中断接收
`Robot_VisionRxStart()` 中调用：
- `Core/Src/freertos.c:920`

```c
HAL_UARTEx_ReceiveToIdle_IT(&huart3, s_vision_rx_buf, VISION_RX_BUF_SIZE);
```

含义：
- USART3 收到一帧数据后
- 当线路空闲时触发回调
- 把本次收到的长度通过中断回传

### 5.3 中断回调记录收到的数据长度
- `Core/Src/freertos.c:1153`

```c
void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
```

当 `huart->Instance == USART3` 时：
- 记录 `s_vision_rx_size`
- 标记 `s_vision_rx_ready = 1`

### 5.4 通信任务轮询解析
- `Core/Src/freertos.c:761`

```c
Robot_VisionProtocol_Poll();
```

此函数负责：
- 拷贝接收缓冲区
- 去掉 `\r\n`
- 校验 `$SWEEP`
- 拆分字段
- 更新视觉相关全局变量
- 重新启动下一轮接收

---

## 6. 视觉变量如何进入状态机

### 6.1 更新的位置
- `Core/Src/freertos.c:1019-1024`

```c
g_vision_detected = clutter_flag;
g_vision_position = clutter_flag;
g_vision_smooth = smooth;
g_vision_raw = raw;
g_vision_decision = decision;
g_vision_distance = (clutter_flag != 0U) ? Robot_EstimateForwardMm() : 0U;
```

### 6.2 各变量含义
- `g_vision_detected`
  - 当前是否检测到目标
- `g_vision_smooth`
  - 平滑后的概率/得分
- `g_vision_raw`
  - 原始概率/得分
- `g_vision_decision`
  - 最终置信度
- `g_vision_distance`
  - 电控内部推导出的“应该前进多少毫米”
  - 不是激光/TOF真实距离
- `g_vision_position`
  - 当前代码里直接等于 `clutter_flag`
  - 语义上并不是“位置坐标”

### 6.3 状态机如何使用视觉结果
核心触发逻辑在：
- `Core/Src/freertos.c:772` `VisionDetectedStable()`
- `Core/Src/freertos.c:819` `Robot_EstimateForwardMm()`

#### `VisionDetectedStable()`
- 在 `STATE_SEARCH_STRAFE` 阶段使用
- 只要满足以下任一条件，就认为当前一帧“命中”：
  - `g_vision_detected != 0`
  - `g_vision_raw >= VISION_RAW_TRIGGER`
  - `g_vision_smooth >= VISION_SMOOTH_TRIGGER`
- 连续命中达到 `VISION_STABLE_COUNT` 后，认为视觉识别稳定

相关阈值：
- `Core/Src/freertos.c:47-53`

#### `Robot_EstimateForwardMm()`
根据 `g_vision_smooth` 粗略映射前进距离：
- `smooth >= 750` -> `2800 mm`
- `smooth >= 600` -> `3400 mm`
- 否则 -> `4000 mm`

注意：
这不是测距模型，而是**经验策略映射**。

---

## 7. 状态机概览

状态枚举定义在：
- `Core/Inc/robot.h:7`

主要状态：

- `STATE_BOOT_PREPARE`
- `STATE_SEARCH_STRAFE`
- `STATE_LOCK_TARGET`
- `STATE_FORWARD_TO_TARGET`
- `STATE_GRAB_CLOSE`
- `STATE_TURN_LEFT_180`
- `STATE_EXIT_STRAIGHT`
- `STATE_RELEASE`
- `STATE_PUSH_FORWARD`
- `STATE_PUSH_BACKWARD`
- `STATE_RETURN_TURN_LEFT_180`
- `STATE_DONE`
- `STATE_ERROR`

### 7.1 与视觉最相关的阶段
#### `STATE_SEARCH_STRAFE`
- 小车横移搜索目标
- 直到 `VisionDetectedStable()` 返回真

#### `STATE_LOCK_TARGET`
- 锁定目标
- 进一步根据视觉结果准备前进策略

#### `STATE_FORWARD_TO_TARGET`
- 根据 `g_target_forward_mm` 前进
- 这个目标距离来自视觉结果映射

因此视觉输入主要影响：
- 是否找到目标
- 目标是否稳定
- 估算前进距离

---

## 8. 接入别的模型时怎么做

## 最优先原则
**不要先改 STM32。先让新模型继续输出同样的 `$SWEEP` 文本协议。**

只要新模型的上位机程序最终输出：

```text
$SWEEP,flag,smooth,raw,decision,state\r\n
```

STM32 端通常可以不动。

### 8.1 推荐做法
新模型推理完成后，在鲁班猫/上位机侧统一转换成当前协议：

```text
$SWEEP,1,823,801,823,CLUTTER

```

你只需要保证：
- `flag` 是 0/1
- `smooth/raw/decision` 是整数
- 每帧以 `\r\n` 结束

### 8.2 什么时候需要改 STM32
只有以下情况才建议改电控：

1. 你不想再用 `$SWEEP` 协议
2. 你想传更多字段（例如左右偏移、框中心、距离、类别编号）
3. 你想改成二进制协议
4. 你想把视觉结果扩展成“位置控制”而不只是“是否有目标”

此时优先修改：
- `Core/Src/freertos.c:939` `Robot_VisionProtocol_Poll()`

而不是先动整个状态机。

---

## 9. 当前代码的风险与限制

## 9.1 接收缓冲区偏小
- `Core/Src/freertos.c:55`

```c
#define VISION_RX_BUF_SIZE 128U
```

当前已经从 64 扩到 128，普通 `$SWEEP,...` 文本更稳。  
但如果以后字段继续变长、改成 JSON 或带更多标签，仍然要继续评估长度上限。

## 9.2 `g_vision_position` 仍然只是占位变量
- `Core/Src/freertos.c` 视觉解析赋值处
- `Core/Inc/robot.h` 变量声明处

当前它仍然等于 `clutter_flag`，只是文档语义已经明确。  
如果以后模型输出左右/角度/中心偏移，建议新增真正的位置变量，而不是继续复用它。

## 9.3 `g_vision_distance` 不是实际距离
- `Core/Src/freertos.c` 中 `Robot_EstimateForwardMm()`

它不是视觉测距结果，而是电控根据阈值映射出的策略距离。  
以后如果接入真实深度/双目/TOF融合距离，不能把这两个概念混用。

## 9.4 视觉阈值是经验值，不是通用值
- `Core/Src/freertos.c:47-53`

这些阈值是和当前模型输出尺度绑定的：
- `VISION_RAW_TRIGGER`
- `VISION_SMOOTH_TRIGGER`
- `VISION_NEAR_SMOOTH`
- `VISION_MID_SMOOTH`

换模型后如果输出分布不同，这些阈值通常都要重新标定。

### 9.4.1 建议的换模型调参顺序
先不要同时改所有阈值，按下面顺序调：

1. **先保证协议不变**  
   新模型先继续输出：
   ```text
   $SWEEP,flag,smooth,raw,decision,state\r\n
   ```

2. **先看原始日志分布**  
   观察电控打印：
   ```text
   [VISION_RX] flag=... smooth=... raw=... dec=... dist=...
   ```
   分别记录：
   - 没目标时 `raw/smooth/decision` 大概是多少
   - 有目标但不稳定时是多少
   - 有目标且稳定时是多少

3. **先调 `VISION_RAW_TRIGGER` 和 `VISION_SMOOTH_TRIGGER`**  
   它们决定 `VisionDetectedStable()` 是否认为“看到了目标”。
   原则：
   - 没目标时不要频繁误触发
   - 有目标时能在较短时间内稳定触发

4. **再调 `VISION_STABLE_COUNT`**  
   如果画面抖动大、误判多，就把它调大。  
   如果识别已经很稳但响应太慢，就适当调小。

5. **最后调 `VISION_NEAR_SMOOTH / VISION_MID_SMOOTH`**  
   这两个不影响“看没看到”，只影响“估算前进多少距离”。

### 9.4.2 一个实用调参办法
建议现场分三组样本观察日志：

- **空场景**：没有目标/杂物
- **临界场景**：有目标但边缘、不清晰、角度偏
- **稳定场景**：目标清楚、姿态正常

记下每组的 `raw/smooth/decision` 大致范围后：

- `VISION_RAW_TRIGGER` 设在“空场景上界”和“临界场景下界”之间
- `VISION_SMOOTH_TRIGGER` 设在“空场景稳定值”和“稳定场景稳定值”之间
- `VISION_NEAR_SMOOTH / VISION_MID_SMOOTH` 结合实际停车位置反复试车修正

## 9.5 当前解析更严格了
目前串口解析已经做了这些加固：
- `flag` 必须是 `0` 或 `1`
- `smooth/raw/decision` 必须是合法数字
- 数值会被限制在 `0~1000`
- 协议错误时会清空视觉数据，避免旧值残留继续驱动状态机

这能减少：
- 上位机发半截包
- 串口抖动带来的乱码
- 错误文本误触发动作

## 9.6 接收方式适合当前低吞吐文本协议
- `Core/Src/freertos.c` 中 `ReceiveToIdle + Poll`

当前方案对这类短文本协议够用。  
但如果以后：
- 帧率更高
- 数据更长
- 需要双向高频通信

就要重新评估丢帧、缓冲和并发处理。

---

## 10. 调试方法

当前调试输出主要通过 `USART1` 的 `printf` 打到电脑串口。

相关代码：
- `Core/Src/usart.c:40-45`

所以：
- 电脑串口助手看到的日志，主要来自 `USART1`
- 视觉输入实际走的是 `USART3`
- 两者不是同一个口

### 10.1 关键日志含义
#### 串口中断收到数据
```text
[UART3_IRQ] size=...
```
说明：
- `USART3` 确实收到数据了

#### 解析成功
```text
[VISION_RX] flag=1 smooth=823 raw=801 dec=823
```
说明：
- 收到了合法 `$SWEEP` 帧
- 数据已经进入全局变量

#### 协议错误
```text
[VISION_ERR] bad_head raw=...
[VISION_ERR] missing_flag raw=...
[VISION_ERR] bad_len=...
[VISION_ERR] empty_frame
```
说明：
- 串口层可能通了
- 但协议格式不符合预期

#### 状态机状态切换
```text
[STATE] SEARCH_STRAFE | ...
```
说明：
- 状态机在运行
- 可以结合视觉变量判断联动是否正常

#### 搜索阶段视觉稳定性判断
```text
[VISION] det=... smooth=... raw=... dec=... hit=... cnt=.../...
```
说明：
- 正在判断是否已稳定识别到目标

---

## 11. 常见故障排查

### 11.1 完全没有 `UART3_IRQ`
说明 `USART3` 根本没收到。
重点检查：
- 鲁班猫串口是否选对
- 是否真的在发送
- `TX -> PD9` 是否接对
- 是否共地
- 波特率是否 115200

### 11.2 有 `UART3_IRQ` 但有 `VISION_ERR bad_head`
说明收到了，但格式不对。
重点检查：
- 是否以 `$SWEEP` 开头
- 是否存在乱码
- 是否少了逗号分隔
- 是否不是 ASCII 文本

### 11.3 有 `VISION_RX` 但动作不对
说明串口和协议基本没问题。  
此时重点检查：
- 视觉阈值是否匹配当前模型
- `VisionDetectedStable()` 是否过严/过松
- `Robot_EstimateForwardMm()` 是否需要重标定

### 11.4 USB 串口偶发掉线
如果鲁班猫端使用 `ttyUSB0`，出现反复断开：
- 检查 CH340 / USB转串口模块
- 检查供电
- 检查 USB 线
- 检查是否被别的进程占用

---

## 12. 建议的对接流程

### 步骤 1：先不接模型，人工发固定协议
先在鲁班猫上手动发：

```text
$SWEEP,1,823,801,823,CLUTTER

```

确认 STM32 日志出现：
- `[UART3_IRQ]`
- `[VISION_RX]`

### 步骤 2：再接入视觉程序
让鲁班猫程序自动发送同样格式的文本帧，确认电控仍能稳定接收。

### 步骤 3：最后替换模型
只替换上位机模型，不改 STM32。  
如果新模型输出尺度不同，再单独调：
- `VISION_RAW_TRIGGER`
- `VISION_SMOOTH_TRIGGER`
- `VISION_NEAR_SMOOTH`
- `VISION_MID_SMOOTH`

---

## 13. 给以后接入者的结论

这套电控设计的核心思想是：

**把视觉系统和电控状态机用一条简单的串口文本协议隔离开。**

所以以后换模型时：

- 优先保持 `$SWEEP` 协议不变
- 优先只改鲁班猫/上位机程序
- 只有在协议字段发生变化时，才改 `Robot_VisionProtocol_Poll()`
- 尽量不要一上来就改状态机

这样改动范围最小，也最稳。
