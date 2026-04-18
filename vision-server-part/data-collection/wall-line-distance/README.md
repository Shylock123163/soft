# wall_line_cat

鲁班猫墙地交界线距离采集工程。

目标：

- 采集墙地交界线图像
- 按距离分成 `near / mid / far`
- 后续训练一个墙距分类模型
- 最后和杂物模型一起部署

默认三类建议：

- `near`：离墙太近，需要减速或停止
- `mid`：合适工作距离
- `far`：离墙较远，需要继续靠近

当前目录：

```text
wall_line_cat/
├─ dataset/
│  └─ raw/
│     ├─ near/
│     ├─ mid/
│     └─ far/
├─ docs/
│  └─ COLLECT_README.md
└─ lubancat/
   ├─ collect_wall_distance_web.py
   └─ start_collect_wall.sh
```

说明：

- 当前杂物模型只能判断 `有/无杂物`
- 它不能直接输出真实距离
- 单目摄像头如果不做标定或专门训练，距离判断不可靠

所以墙距建议单独做这一套。
