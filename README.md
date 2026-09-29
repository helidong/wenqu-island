# 文曲岛奇遇

一座可以自由探索的 3D 语文岛：拼音、常用汉字、成语、古诗词、中国历史，边玩边学，从童生一路考到状元。

在线游玩：https://helidong.github.io/wenqu-island/

## 岛上有什么

| 区域 | 考官 | 内容 |
|---|---|---|
| 文曲广场 | 文曲星君、书童小墨 | 状元大挑战（五科混合）、今日功课、图鉴 |
| 拼音村 | 音韵先生 | 声母/韵母/整体认读音节表、听音辨声调、拼音气球、声母韵母找一找、声调钟 |
| 汉字林 | 仓颉 | 500 个常用字（笔顺动画、描红、部首、组词、例句）、字音考验、偏旁拼字、象形字猜猜、石碑 |
| 成语城 | 说书人 | 240 个成语（106 个故事）、成语填空、看图猜成语、成语接龙、释义连连看、杂货铺 |
| 诗词山 | 李白等诗人 | 117 首古诗词（可逐句朗读）、32 位诗人、上句接下句、诗句排序、猜作者、飞花令、鹳雀楼 |
| 历史长廊 | 司马迁 | 远古到清的 21 道朝代牌坊、70 位人物、180 道历史题、20 件文物、长城、兵马俑 |

探索要素：会读字的「字灵」、42 个宝箱和 83 张知识卡、19 枚印章、科举等级（童生→状元）、铜钱商铺（衣帽、熊猫/仙鹤/麒麟、筋斗云）、昼夜与十二时辰、五声音阶背景音乐。

## 操作

- 电脑：WASD / 方向键移动，Shift 奔跑，空格跳，拖动鼠标转视角，滚轮缩放，E 互动，M 地图，B 图鉴，N 商铺
- 手机：左下摇杆移动，拖动屏幕转视角，双指缩放，点地面自动走过去，点按钮互动

进度保存在浏览器本地（localStorage），换设备或清除网站数据会丢失。

## 本地运行

纯静态页面，无需构建：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 目录

```
index.html          页面与样式
js/core.js          工具、拼音处理、存档、语音、音效、界面组件
js/world.js         three.js 3D 世界：地形、建筑、人物、宝箱、字灵、镜头
js/games.js         全部学习卡片与小游戏
js/main.js          启动
js/data/*.js        内容数据（拼音、汉字、成语、诗词、历史、笔顺）
```

加内容只需编辑 `js/data/` 下对应的数据文件。

## 致谢

- 3D 渲染：[three.js](https://threejs.org/)（r128）
- 笔顺动画与描红：[Hanzi Writer](https://hanziwriter.org/)
- 笔顺数据 `js/data/strokes.js` 来自 [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data)，源自 [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)，遵循 Arphic Public License
- 字体：Google Fonts（Ma Shan Zheng、Noto Sans SC、Noto Serif SC）
- 朗读：浏览器自带的 Web Speech 中文语音
