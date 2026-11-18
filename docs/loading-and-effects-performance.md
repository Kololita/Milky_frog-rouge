# 加载与战斗特效性能

启动采用共享模型队列，最多两个 GLB 同时读取、解析和解码，并在释放队列名额前短暂让出执行时间。运行时模型工厂仍负责自己的验证、动画绑定及缓存。队列 FIFO 单次入队和出队摊销为 O(1)，预处理循环通过时长预算留出主线程空档，单个浏览器解码或驱动调用的实际用时由浏览器决定。

画面准备统一使用 `startup-warmup.js`。纹理按对象去重，材质编译分批提交，按实际场景的灯光、环境和渲染目标编译。锅炉房分别绘制干湿两种真实场景，最后异步等待 GPU 完成。进度条反映已完成的作业，不依赖定时模拟。

战斗特效通过 `player-effects.js` 接入模型绑定、资源预加载、姿态恢复、姿态叠加、视觉更新和清理。具体特效仍管理自己的模型、着色器和状态；战斗逻辑提供事件与状态。特效光源使用固定灯位和可变强度，休眠强度为零。增加循环特效时优先复用几何体、实例数据与材质，位置、强度和时间通过 uniform 或属性更新，避免为了效果的显隐改变灯光数量或 Shader 定义。独立 GPU 模拟与后处理保留自己的渲染目标，避免将玩法状态读回 GPU。

Three.js 的 `compileAsync()` 支持异步等待着色器编译，编译时应先配置目标场景灯光和环境。主线程任务仍需要分批和让出时间。[Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer) · [Chrome 性能指南](https://web.dev/articles/optimize-long-tasks)

## 第一轮对照

使用同一台设备的无界面 Edge，在训练场和锅炉房依次触发完美格挡的金光与吸收。前后启动用时约 46.35 s 和 28.64 s，页面主线程任务累计约 33.01 s 和 17.75 s。该计数不含系统所有进程，不能推断任务管理器的瞬时总 CPU 占用率。

| 首次触发 | 修改前最长帧 | 第一轮修改后最长帧 | 新增程序前后 |
| --- | ---: | ---: | ---: |
| 训练场完美格挡 | 720.7 ms | 4.3 ms | 9 → 0 |
| 锅炉房完美格挡 | 12204.6 ms | 4.3 ms | 28 → 0 |
| 锅炉房吸收金光 | 12367.2 ms | 4.4 ms | 24 → 0 |

原始记录位于 `output/effects-performance-before.json` 和 `output/effects-performance-after.json`。后一个记录早于玩家特效生命周期整理。复现入口为 `node tools/verify-foundry-edge.mjs --check-effects --check-progress`，启动服务后执行。无界面浏览器的刷新节奏与实际窗口可能不同，着重比较首用尖峰和是否创建了新程序。

生命周期整理后的复测中，主菜单在 28.19 s 可用，主线程任务累计为 18.02 s。三项首次触发的最长帧分别为 4.3、4.3、4.5 ms，程序增量均为零。另一次首次喷水测试中，喷水前后的程序数均为 245，152 个有效帧间隔都低于 25 ms。两项测试都检查了从 0% 到 100% 的加载进度、主菜单和浏览器错误。记录位于 `output/effects-performance-final.json` 与 `output/startup-water-final.json`。

## 实例资源与敌人视图

气功球、拳风和敌方弹丸共用 `effect-instances.js`。它持有每种效果的几何体和材质，实例数据按容量翻倍扩展，只提交有效范围。敌方弹丸的外壳和光环共用颜色缓冲区，创建初始实例时就启用实例颜色。累计扩容工作随峰值实例数量线性增长，平时更新与活跃实例数量成正比。拳风以原地压缩清理到期实例。

血瓶姿态求解复用向量和四元数，循环中只更新相关骨骼的祖先链。361 帧合成骨架对照中，关节和瓶子的变换完全一致。同一次局部 Node 测试的总耗时为 52.53 → 4.89 ms，这组数据仅覆盖合成骨架的姿态求解。Edge 实际游戏验证确认第一发弩尾蜥弹丸显示正常，血瓶显示和结束隐藏正常，生命从 50 恢复至 100。这两次触发均无新增着色器。WebGL 像素测试验证了 40 枚弹丸扩容后的红绿两色、气功蓄力与飞行、拳风白气及释放后的清理。

敌人视图在资源就绪后优先创建当前生效的骨骼模型，备用程序模型按需建立。视图切换只改变旧模型和新模型的可见性。正式模型在用时不计算隐藏替身的姿态。每个敌人的独立特效仍由原有特效模块控制，开场预热会遍历战斗名册。

## 场景预热与 CPU 采样

环境反射按实际捕获相机和灯光预编译，竞技场和休息处使用各自的实战机位预热。锅炉房编译只遍历场景所需的资源，并覆盖水阀的两种状态。无界面 Edge 的对照中，主菜单可用时间由 28.00 s 降至 19.15 s。镜盾侍首次入场最长帧由 929.2 ms 降至 20.8 ms，武士由 116.7 ms 降至 4.4 ms。首次喷水复测的 148 个有效帧间隔均在 4.5 ms 以内。记录位于 `output/startup-scenes-phases-before.json`、`output/startup-scenes-phases-final.json` 和 `output/startup-scenes-water-final.json`。

`tools/measure-startup-cpu.ps1` 每约 500 ms 采样整机 CPU，同时记录 Edge 的实际显卡、并行着色器编译支持和主线程长任务。一次冷启动使用 RTX 5070 Ti Laptop GPU，整机 CPU 采样平均 10.29%、最高 31.95%。资源加载约 0.99 s，环境反射约 9.82 s，锅炉房画面预热约 5.07 s。最长主线程任务在环境反射阶段持续约 7.27 s，包含浏览器和显卡驱动调用的等待时间。整机采样峰值不覆盖短于采样窗口的尖峰，主线程长任务时长也不能换算成整机 CPU 占用率。记录位于 `output/startup-cpu-browser.json` 和 `output/startup-cpu-system.csv`。

## 锅炉房 HDR 反射烘焙

静态环境反射按光照档位预先捕获。每份资源保存六个原始方向的线性 RGBA16F 值，以 gzip 无损压缩。首屏读取当前灯光档位，默认资源约 1.7 MiB。GPU 按反射质量上传或缩采样到 64、128 或 256 像素，并生成供粗糙材质采样的预滤波贴图。切换时保留上一份反射，直到新贴图完整可用，再释放旧的 GPU 资源。资源缺失时回退到实时捕获。缺少浮点渲染目标支持的设备使用 RGBA8 岩浆反射，粗糙材质省略 HDR 环境反射。镜盾继续由实时反射提供动态画面，开场提前编译其离屏渲染所需的着色器。[Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html) · [MDN Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)

更新锅炉房静态美术或灯光后，打开网页服务并运行 `node tools/verify-foundry-edge.mjs --bake-reflections`。检查 `output/foundry-probe-{low,medium,high}.bin.gz` 后，将其分别复制为 `public/textures/foundry/probe-{low,medium,high}.bin.gz`。捕获使用标准阴影配置。在反射质量为高时，GPU 上传后读回的 1,572,864 个分量与资产逐项相同。切换六种灯光与反射档位组合后，运行中的纹理数量仍为 86。记录位于 `output/reflection-pixels.json` 和 `output/reflection-fallback.json`。

同机复测中，完整冷启动由 18.92 s 降至 10.96 s，环境反射阶段由 9.82 s 降至 0.054 s，页面主线程累计任务时间由 10.38 s 降至 3.38 s。镜盾离屏预编译后，镜盾预热阶段的最长任务由 964 ms 降至 381 ms。锅炉房正式画面预热仍需约 6.26 s，其中最长单次任务 433 ms。金光和吸收在训练场及锅炉房首次出现的最长帧均不超过 4.5 ms，未新增着色器。记录位于 `output/startup-cpu-final-browser.json` 和 `output/reflection-effects.json`。

锅炉房的铆钉、排水格栅和梁柱按几何形状复用模板和摆放对象，保留同一批实例矩阵。30 次独立构造对照中，创建的几何体数由 1,072 减至 25，单次构造中位数由 8.43 ms 降至 1.10 ms。纹理与面光源资源在构建场景时初始化，模块导入阶段无需访问页面。之后复测整机 CPU 约每半秒采样，平均 16.31%、最高 38.10%，冷启动约 10.97 s。较早的整机样本采样时长不同，峰值和平均值都受到其他进程影响。模拟缺失浮点渲染扩展时，RGBA8 岩浆反射、水流步进和清理通过浏览器验证。记录位于 `output/startup-cpu-art-browser.json`、`output/startup-cpu-art-system.csv` 和 `output/foundry-fallback.json`。

## 着色器提交与链接

锅炉房原本十批编译的 JavaScript 提交累计约 35 ms，分批等待驱动完成耗时约 5.93 s。启动调度共用同一个逻辑核心数预算。模型至多同时解码两份，着色器默认至多同时提交两批，每批 32 个对象。支持并行编译的 WebGL 路径用非阻塞查询确认各实际 GL 程序的链接状态。一个材质在同一批里可以产生多个程序，完成条件覆盖这些变体。缺少扩展时逐个确认链接，并在超出时间预算时让出主线程。并行扩展提供非阻塞查询，驱动决定实际编译线程。 [Khronos 并行编译规范](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/) · [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

| Edge 冷启动条件 | 到主菜单 | 锅炉房着色器预热 | 页面主线程累计任务时间 |
| --- | ---: | ---: | ---: |
| 串行基线 | 11.45 s | 6.45 s | 3.31 s |
| 模拟八逻辑核心，至多两批 | 7.79 s | 3.13 s | 3.13 s |
| 本机 32 逻辑核心，三批实验 | 7.08 s | 2.68 s | 3.04 s |
| 本机 32 逻辑核心，两批默认 | 7.67 s | 3.22 s | 3.03 s |

默认两批时整机 CPU 的 0.5 s 区间峰值为 29.24%，基线为 29.92%，三批实验为 45.44%。八逻辑核心限额的独立采样峰值为 35.08%。模拟关闭并行扩展后，逐个确认链接把最长主线程任务从 1.70 s 降至 0.75 s，冷启动从 6.01 s 升至 9.61 s。记录位于 `output/startup-batch-{baseline,two,adaptive,default}-browser.json` 和 `output/startup-batch-fallback-final.json`。

默认两批测试中，训练场与锅炉房的首次完美格挡和金光吸收最长帧约 4.4 ms，各自着色器数量稳定。另验证了首次进场、锅炉房首次喷水、镜盾和武士特效像素、技能、弹丸，以及 60 次跨场景切换后的纹理、几何体和程序数。浏览器组合更改的模拟用于覆盖分支，计时来自本机实际显卡。记录位于 `output/startup-batch-default-effects.json`、`output/startup-batch-water.json`、`output/foundry-visual-check.json` 和 `output/foundry-scene-cycles.json`。

## 预生成角色受击动画

使用浏览器启动跟踪定位到资源加载阶段约 425 ms 的微任务。该阶段每次启动都从骨骼、蒙皮和原有动画求解坐倒、击飞时的撑地姿态。现由 `tools/bake-player-hit-clips.mjs` 运行同一求解器，产出约 586 KiB 的压缩动画资源，模型 GLB 保持原样。加载器用模型字节的 SHA-256 验证动画是否匹配。资源缺失、版本不符或当前环境无法生成校验值时，求解器按帧分段重建，复用加载的时间预算。更换奶蛙模型或修改受击动作后，可运行 `node tools/bake-player-hit-clips.mjs` 更新资源，使用 `--check` 检查版本和轨道数值。[Chrome DevTools 启动跟踪说明](https://developer.chrome.com/docs/devtools/performance/reference)

Edge 实测比较了受击、坐倒和击飞的 894 条轨道、608,350 个关键帧数值，时间、插值类型和值均一致。资源加载阶段由约 956 ms 降至 650 ms，原 425 ms 微任务在预生成和缺失重建两条路径的复测中均未出现。全程冷启动仍受着色器编译波动影响。基线跟踪、正常、缺失及动画对照分别见 `output/startup-resource-trace.json.trace.json.gz`、`output/startup-baked-hit-browser.json`、`output/baked-hit-missing.json` 和 `output/baked-hit-playback.json`。

支持并行链接查询时，在着色器就绪后按时间预算提前初始化参数和顶点属性位置。同机样本中，普通场景的相关长任务由约 364 ms 降为 64 ms，镜盾离屏首次调用由约 348 ms 降为 130 ms。锅炉房首次预览仍有约 0.4 s 的同步绘制任务。记录位于 `output/startup-program-bindings.json`。

## 锅炉房后处理与水流预热

首次干场预览中，场景绘制约 29 ms，泛光约 267 ms，还伴随首次水流计算的驱动等待。现在场景、镜盾反射、泛光和水流计算共用按实际渲染目标分批编译的入口。启动提前初始化泛光目标和色调映射程序，水体体积密度、粒子积分、水面密度也在各自的计算目标预编译。湿润场景仍实绘一次。泛光在 GPU 上沿用原有的多级纹理与混合流程。 [Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html) · [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

Edge 本机对照中，干场预览由约 401 ms 降至 32 ms。泛光耗时约 0.5 ms，泛光与最终输出均未在该帧创建新程序。水流预热仍需约 0.48 s，等待已分散，首次预览阶段原来的长任务消失。9,216 个像素的实际 GPU 对照逐像素相同。首次喷水前后均为 162 个程序。记录位于 `output/startup-foundry-passes-{before,water}.json`、`output/foundry-post-pixels.json` 和 `output/foundry-compiled-water.json`。

最终生产构建冷启动在 8.46–9.80 s，整机 CPU 按约 0.5 s 采样平均 13.91%、峰值 32.84%。训练场与锅炉房首次完美格挡和金光吸收的最长帧为 10.3 ms，触发前后各场景的程序数稳定。GPU 特效像素、缺少浮点扩展、反射资源缺失以及 60 次场景切换均通过验证。记录位于 `output/startup-foundry-production-browser.json`、`output/foundry-production-effects.json` 和 `output/foundry-scene-cycles.json`。
