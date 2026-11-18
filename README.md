# 奶蛙 · Milky Frog

奶蛙是一款第三人称动作 Roguelike，使用 Three.js、Vite 和 Electron。当前版本为 **0.3.1**。进入练习场或新手教程熟悉操作，开始远征后可在地图上选择战斗、事件和休息点，也可以从竞技场单独挑战首领。

## 开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

打开终端中的地址，默认是 http://127.0.0.1:5173/。运行 `npm run build` 生成网页构建。Windows x64 桌面版使用 `npm run package:win -- --publish never`，安装包和免安装 ZIP 输出到 `release/0.3.1/`。首次打包会下载并校验 Electron 运行时。

默认按键包括 WASD 移动、空格跳跃、Shift 疾跑或点按闪避、鼠标左键攻击、右键格挡、Q 锁定、R 喝药、I 装备、E 主动大笑。1 为金光技能，2 为装配技能，3 为大招。键位可在设置中修改。

## 协作入口

- `src/` 存放玩法、输入、界面和场景代码，`desktop/` 存放 Electron 入口。
- `public/` 存放实际运行的模型、纹理、动画和界面资源。
- `assets-source/` 存放 Blender 源文件、低模和美术参考。导出的游戏模型放入 `public/models/`。
- `tools/` 存放制作、构建和验证脚本。依赖、缓存、预览输出和安装包由各自流程生成。
- [代码结构](docs/代码结构.md)、[战斗数值](docs/战斗数值.md)、[怪物设计](docs/monsters/README.md)、[装备与掉落](docs/装备与掉落.md)、[装配台](docs/装配台.md)、[远征地图](docs/远征地图.md)、[模型同步](docs/模型同步.md) 和 [渲染与启动预热](docs/渲染与启动预热.md) 记录相应设计与实现。

Windows 下载见 [GitHub Releases](https://github.com/Kololita/Milky_frog-rouge/releases)。
