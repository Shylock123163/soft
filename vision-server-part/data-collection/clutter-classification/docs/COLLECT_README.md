# 鲁班猫采图说明

## 目录

鲁班猫端脚本在:

- `lubancat/collect_dataset_web.py`
- `lubancat/start_collect.sh`

图片保存到项目根目录:

- `dataset/raw/clean`
- `dataset/raw/clutter`
- `dataset/raw1/clean`
- `dataset/raw1/clutter`

## 建议部署目录

把整个 `new_lable` 文件夹放到鲁班猫:

```bash
/home/cat/new_lable
```

## 依赖

鲁班猫需要:

- `python3`
- `opencv-python`
- `flask`

## 启动

在鲁班猫执行:

```bash
cd /home/cat/new_lable
bash lubancat/start_collect.sh
```

浏览器打开:

```text
http://鲁班猫IP:5004
```

## 当前用途

这版页面用于“误判增量采集”:

- 页面会显示第一个模型的判断
- 你现场看到误判后直接点保存
- 新图默认全部保存到 `raw1`
- 模型文件默认放在 `lubancat/test1.pt`

## 页面按钮

- `保存为 clean`
- `保存为 clutter`
- `clean 连拍10张`
- `clutter 连拍10张`
- `clean 连拍30张`
- `clutter 连拍30张`

点一次保存一张。

现场使用建议:

1. 先看页面上的模型判断。
2. 无杂物却被判成有杂物: 点 `保存误判为 clean`。
3. 有杂物却被判成无杂物: 点 `保存误判为 clutter`。
4. 同类误判很多时，直接用连拍按钮。

## 上传目录

建议鲁班猫端保持这个结构:

```text
sweep_cat/
├─ lubancat/
│  ├─ collect_dataset_web.py
│  ├─ start_collect.sh
│  └─ test1.pt
└─ dataset/
   └─ raw1/
      ├─ clean/
      └─ clutter/
```

也就是 `test1.pt` 直接和 `collect_dataset_web.py` 放在同一个 `lubancat/` 文件夹里。

## 采多少张

- `clean`: 先做可用版时最低 `150` 到 `300` 张
- `clutter`: 先做可用版时最低 `150` 到 `300` 张

想把稳定性做得更高，再补到:

- `clean`: 推荐 `800` 到 `1500` 张
- `clutter`: 推荐 `800` 到 `1500` 张

两类数量尽量接近。

## 采集规则

- 相机尽量固定
- 光照尽量多样但不要过暗
- 不要一直拍完全重复的图
- 同一点位连续拍 `3` 到 `5` 张就够
- 多换角度、多换距离、多换地面

## 快速采集办法

最快的做法不是一张一张点，而是:

1. 先找 `15` 到 `20` 个不同机位
2. 每个机位点一次 `连拍10张`
3. 换一点角度、距离、光照再点下一次

这样很快就能到:

- `15` 个机位 x `10` 张 = `150` 张
- `30` 个机位 x `10` 张 = `300` 张

建议先做第一版:

- `clean` 先采 `150` 到 `200` 张
- `clutter` 先采 `150` 到 `200` 张

先训练一版看效果，不够再补“容易误判”的场景。

## 说明

这个项目是二分类，不需要框选标注。
你只要把图分到 `clean` 和 `clutter` 两类即可。
