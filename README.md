# 节奏可视化 Demo Lab — 交接说明

一个纯前端的原型：用音频特征（BPM / 节拍 / 段落 / Drop / Kick / Snare / Hi-hat / 三段能量）实时驱动画面上的程序化动效，用来快速验证「音乐 × AI 视效」玩法的差异化和可玩性。

- 线上体验：[https://haodman.com/audio-visual-lab/](https://haodman.com/audio-visual-lab/)
- 源码仓库：[haodman/Audio-Visual-Lab](https://github.com/haodman/Audio-Visual-Lab)
- 默认分支：`main`
- 新同事 / Codex 交接：[`handoff/CODEX_START.md`](handoff/CODEX_START.md)

---

## 1. 怎么跑

`music-fx-lab.html` 是构建后的完整程序，双击或通过静态服务器都可以运行。图片封面会内嵌，音频保留为 `src/music/**/*.mp3` 按需加载，避免首页一次下载几十 MB。

需要联网的主要是字体与浏览器端 AI 模型，断网会自动降级、不会崩：
- Google Fonts（Manrope）→ 断网回落系统字体
- 静态图使用 MODNet 高清抠像（Transformers.js + WebGPU，首次下载后走浏览器缓存）
- 视频实时预览使用 MediaPipe Selfie Segmentation（jsDelivr CDN）
- 模型加载失败时回落到内置启发式抠像

**要改代码的话**用 `src/` 里的三个文件，不要直接改那个 1.2MB 的单文件（里面图片是 base64，很难编辑）：

```
src/app.html      # 结构 + 全部 CSS（约 290 行）
src/app.js        # 全部逻辑（约 1500 行，分 9 个 section）
src/build.py      # 把 app.html + app.js + models/*.jpg 打包成单文件
src/models/*.jpg  # 20 张预置素材（540×960 裁切好的 9:16）
src/music/       # 真实测试音乐、波形封面、LRC 和 library.json
```

改完执行 `python3 src/build.py`，产出 `music-fx-lab.html`。提交代码时请同时提交构建后的 HTML，否则别人拉取仓库后会看到旧版。

### 本地启动

```bash
git clone https://github.com/haodman/Audio-Visual-Lab.git
cd Audio-Visual-Lab
python3 -m http.server 8765
```

打开 [http://127.0.0.1:8765/music-fx-lab.html](http://127.0.0.1:8765/music-fx-lab.html)。不建议用 `file://` 直接调试，因为音频、模型和文件夹权限在不同浏览器里可能受限。

### 修改后自检

```bash
node --check src/app.js
python3 src/build.py
git diff --check
```

然后在 Chrome 里至少验证：页面刷新、切换歌曲、播放/暂停、切换效果、打开参数抽屉、选择素材和导出 15 秒视频。

---

## 2. 团队协作与推送

可以由多人继续维护。该仓库目前是 **Private**，管理员需要先在 GitHub 仓库的 `Settings → Collaborators and teams` 中邀请同事。

- 只需查看：授予 Read。
- 需要建分支、推送和提 PR：授予 Write。
- 不建议所有人直接推送 `main`；一个需求使用一个分支和一个 Pull Request。

推荐流程：

```bash
git pull --rebase origin main
git switch -c feature/effect-name

# 修改 src/app.html / src/app.js / 素材后
node --check src/app.js
python3 src/build.py

git add src music-fx-lab.html index.html design-qa.md
git commit -m "Add or refine effect name"
git push -u origin feature/effect-name
```

然后在 GitHub 上创建 PR，请另一位同事完成预览和代码检查后合并。

### 线上发布的重要说明

`Audio-Visual-Lab` 是源码仓库；`haodman.com` 的 Vercel 站点来自另一个 `haodman/haodman.com` 仓库。因此：

1. 合并到 `Audio-Visual-Lab/main` 会更新源码，**目前不会自动更新 haodman.com**。
2. 要发布线上版，需把新的 `index.html`、`music-fx-lab.html` 和它们引用的 `src/music/` 资源同步到 `haodman/haodman.com` 的 `audio-visual-lab/` 目录。
3. `haodman.com` 仓库合并到 `main` 后，Vercel 会自动部署。
4. 发布后请实际打开 [https://haodman.com/audio-visual-lab/](https://haodman.com/audio-visual-lab/)，不要只以「GitHub 推送成功」作为验收。

如果同事只有 `Audio-Visual-Lab` 的 Write 权限，他可以正常开发和提 PR，但不能自己发布到 `haodman.com`；线上发布还需要 `haodman.com` 仓库的 Write 权限。

左侧手机中央的发布按钮会直接导出 15 秒 9:16 成片，包含当前图片、所选音乐、当前动态特效和手机端 UI。Chrome 支持时优先导出 MP4；不支持 MP4 编码时会自动回退为 WebM。

---

## 3. 代码结构（app.js 的 9 个 section）

| # | 模块 | 干什么 |
|---|---|---|
| 1 | SOURCE | 素材进画布。`src` 是一张 540×960 的离屏 canvas，所有效果都从它读。还有亮度网格 `lumGrid()`、边缘图 `edgeMap()`、抠像 `subject()`、轮廓 `contour()` 等缓存工具 |
| 2 | AUDIO | 12 首 WebAudio 合成曲 + 6 首真实测试音乐。真实曲目由 `music/library.json` 管理，含封面和 LRC 时间轴 |
| 3 | OFFLINE ANALYSIS | 音频进来先离线分析一次：分带滤波 → onset 包络 → 梳状自相关求 BPM → 节拍网格 + 小节线 → 能量分段（铺垫/推进/高潮）→ Drop 定位 → 曲风推测 |
| 4 | PLAYBACK + LIVE FEATURES | 播放 + 实时 FFT。每帧产出一个特征对象 `f`，这是整个项目的核心接口 |
| 5 | EFFECTS | 效果全在一个 `FX` 对象里。**你要加东西基本只动这里** |
| 6 | RENDER LOOP | 每帧：算特征 → 调当前效果的 `draw()` → 更新仪表盘 |
| 7 | UI | 控制面板、效果分类标签、参数面板、歌曲弹窗 |
| 8 | LOCAL LIBRARY | 拖拽/文件夹导入的素材和音乐，存 IndexedDB，刷新不丢，只在本机有效 |
| 9 | REMOTE MANIFEST | 线上部署用：从 JSON 拉素材和曲目 |

### 每帧的特征对象 `f`

```js
{
  kick, snare, hat,      // 0~1，瞬态检测，鼓点那一刻冲到 1 再衰减
  bass, mid, high,       // 0~1，三段能量（平滑过）
  energy,                // 0~1，整体能量
  beat, bar,             // 0~1，节拍/小节脉冲（对齐离线算出来的节拍网格）
  beatPhase,             // 0~1，当前在这一拍的哪个位置
  drop, dropHold,        // Drop 瞬间冲击 / Drop 后 2.2 秒的余韵
  section,               // '铺垫' | '推进' | '高潮'
  bpm, t, nextDrop
}
```

---

## 4. 加一个新效果（最常见的改动）

在 `app.js` 的 `FX` 对象里加一项，再把 id 加进 `FX_ORDER`，就出现在界面上了。模板：

```js
myfx: {
  name: '效果名', icon: '✨', desc: '一句话描述（显示在标题栏）',
  hint: '详细说明，显示在参数弹窗里',
  params: [
    R('amt',  '强度', 0, 1, .5),          // 滑杆：key, 标签, min, max, 默认[, step]
    C('col',  '颜色', '#ffffff'),          // 取色器
    Sel('mode','模式', ['A','B'], 'A'),    // 下拉
    T('text', '文案', '默认文字'),          // 文本框
    D('drv',  'kick'),                     // 驱动源选择器（可限定可选项）
  ],
  state: {},                               // 效果自己的持久状态
  draw(f, p, t) {
    // f = 特征对象, p = 当前参数值, t = 秒
    ctx.drawImage(src, 0, 0);              // 先铺底图
    // ...你的绘制，用 f.kick / f.energy 等驱动
    dropFlash(f, p);                       // Drop 时的白闪（可选）
  }
},
```

画布是 `540 × 960`，常量 `W` / `H`。可用的工具函数：

- `subject()` → 抠好人物的 canvas（透明背景），用于"只作用于人物/只作用于背景"
- `contour()` → `{cx, cy, rad}`，人物轮廓的极坐标半径函数，配 `radAt(ct, angle)` 用，环绕文字就是用这个
- `lumGrid(pitch)` → 降采样的亮度网格，做点阵/字符画/粒子用
- `rgbSplit(ctx, offset)` → RGB 通道分离
- `edgeMap()` / `halftonePattern()` → 边缘图 / 半调网点
- `clamp / lerp / rnd / rgba`

**一个建议**：加效果时优先想"换个驱动源会不会变成另一个玩法"。同一套绘制逻辑挂在 Kick 上和挂在 Hi-hat 上，观感差别很大，这是拉开和现有模板差距最省力的地方。

---

## 5. 现有效果

原图、风迹、上下分屏、碎块位移、轮廓声场、单图打孔、像素扫描、LED 点阵、马赛克脉冲、波普四宫格、字符画、字符雨、频谱条、局部像素显影、局部横向拉丝。

每个效果的技术能力、当前 Demo 边界与生产化建议见 `TECH-CAPABILITIES.md`。

另有 30 个先前做过、目前从界面移除的效果，完整代码存在 `src/effects-archive.js` 里（百叶窗、分屏、立体翻转、镜像对称、网格切换、像素拉伸、像素排序、CRT、时间切片、胶片颗粒、频闪重影、径向拖影、冲击波、声波涟漪、环绕文字、轮廓心跳、主体残影、霓虹描边、粒子消散、融化下坠、拼图落位、组图海报、形状蒙版、唱片旋转、碎片飘落、彩虹气泡、五线谱、曲线文字、逐字歌词、节拍推近）。要恢复某一个：把对应条目粘回 `app.js` 里 `const FX = {` 的对象，再把它的 id 加进 `FX_ORDER`，重新 build 即可，依赖的工具函数都还在。

## 6. 人像分割

所有静态图效果统一使用 **MODNet** 做高清 Alpha Matting（Transformers.js + WebGPU）。「局部横向拉丝」等 9:16 效果与「歌词双生分屏」的 9:8 构图使用同一模型和边缘处理，只按各自的裁切尺寸分开缓存结果；首次会下载模型，之后使用浏览器缓存。视频为了保持实时性使用 **MediaPipe Selfie Segmentation**。加载失败或离线时，回落到内置启发式抠像（边界洪泛 + 边缘阻挡 + 中心先验），质量较低但不会崩。当前状态显示在「素材」卡片标题右侧，勾选效果卡片里的「看抠像」能直接检查分割结果。

要换成公司自己的分割服务，可替换 `refineSubjectHQ()`（静态高清）和 `refineSubject()`（视频实时）：拿到与目标画面同尺寸的 Alpha Mask 后写入对应缓存，其它效果无需改动。

---

## 7. 上线部署

单文件直接传静态服务器即可。素材和音乐建议走 manifest，不要再往 HTML 里塞：

```
https://你的域名/music-fx-lab.html?manifest=https://你的CDN/assets.json
```

`assets.json` 格式：

```json
{
  "photos": [
    { "name": "车内自拍", "tags": ["自拍","室内"], "url": "https://cdn/.../a.jpg" }
  ],
  "tracks": [
    { "id": "t1", "name": "曲名", "genre": "House", "bpm": 124, "url": "https://cdn/.../a.mp3" }
  ]
}
```

CDN 需要开 CORS。也可以在页面里设 `window.MFX_MANIFEST = '...'`。

**音乐版权**：内置那 12 首是程序合成的，可以随便用。要放真实歌曲，必须是拿到授权的或免版税曲库的，通过 manifest 或本地拖拽导入，不要打包进 HTML 再对外发布。

---

## 8. 已知限制 / 下一步建议

- BPM 偶尔会识别成一半或两倍（Trap 常报 70 而不是 140，这是半拍的正常现象）；Drop 检测对混音动态依赖比较大，做过了阈值调优但不是百分百
- 视频素材使用 MediaPipe 实时分割，质量会低于静态图的 MODNet 高清抠像
- 内置曲目是首次点击时才合成（1~3 秒），之后缓存
- 当前浏览器端导出固定为 15 秒；采用 `MediaRecorder` 合成 canvas 与 WebAudio，编码格式由 Chrome 能力决定（MP4 / WebM）
- 值得继续推的两个方向：① 按曲风自动推荐"效果 × 驱动 × 参数"的预设包；② 多图按小节切换的节奏剪辑（参考组图玩法）

## 交错色条：照片选择、取色与节奏规则

`colorBars` 将用户提供的 MDP 交错色条模板接入现有工作台。打开 `music-fx-lab.html?effect=colorBars`，在素材区选择「1 张 / 2 张 / 3 张」，再点素材依次填入；也可点击编号缩略图指定替换位置。参数抽屉中每张照片可独立选图、上传替换和调整裁切，并可输入自己的短文字。默认照片宽度 58%，9:16 构图；色条跟随现有 WebAudio DSP 的分析拍点伸缩，文字向上弹跳并保持在画面内。此效果导出纯画面的 540×960 视频；其他效果沿用原导出行为。

实现位于 `src/color-bars.js`，字体和三张默认示例随构建内嵌。`python3 src/build.py` 同时生成 `music-fx-lab.html` 与 `index.html`，不手改生成文件。新效果不使用歌词对齐或 Beat This!。本地审片通过前不推送或发布；发布仍需按上述双仓库流程同步并验看线上。


### 色条取色

- **每张照片独立取色**：只采样当前真正显示的裁切区域，不把三张照片混在一起，也不从画面外的原图取色。改变照片、数量、宽度或裁切位置后，重新计算该构图的色板。
- 把裁切区域缩小至 80×120，再用 OKLab 感知色彩空间聚类，最多 9 个候选色簇。滤掉占采样点不超过 1.5% 的极小色簇，避免孤立像素变成色条。
- 先选占面积最大的主色；再优先保留颜色鲜明、与主色有区分的小面积强调色；其余按色差、面积和鲜明程度补齐，最多 4 色。不会额外提高饱和度，色条使用选中色簇的平均 RGB。
- 有效颜色不足四种时复用已有颜色，因此单色照片仍保持原色。每张照片有左右各三处可伸出位置；色板按颜色在照片中的纵向中位位置排序，再轮流分配。位置使用固定的错落构图，不等于逐行像素拉丝。
- 远程图片若因跨域等原因无法读取像素，程序才退回灰绿 `#677970`、浅米 `#C6B88F`；默认随包示例与本地上传正常使用真实取色。

### 背景颜色

- 固定浅暖灰 `#EEEDE7`（RGB 238, 237, 231），保持照片和色条清晰。
- 叠加非常淡的固定纸纹：RGB 67, 65, 47，透明度 3.5%。纹理不移动。
- 背景不从照片自动取色，不随换图、节拍、音量或歌曲变化。文字固定深绿 `#2B362F`。

### 同拍条数与粗细

- 默认「随重音 1–3 条」：继续用原 WebAudio DSP 的 `S.analysis.beats` 作为起点。取每个拍点前 25ms 至后 90ms 的音频 RMS，与本首歌有效拍点的 40%、80% 分位比较，轻拍 1 条、普通拍 2 条、重拍 3 条。静音拍点不触发。
- 同一拍的色条同时出发，优先分散到不同照片；单图时分配到同侧三个位置。下一拍换到另一侧。这里的「1–3 条」指每拍新触发条数，前一拍正在收回的色条可能短暂共存。
- 可改为每拍固定 1、2 或 3 条。每条均完整伸出、停留、收回；文字依次分配至各条，向上跳起再回原位。
- 基础色条厚度为 10–18px（在 540×960 画布上），比第一版本约粗三成；「色条粗细」可调至 0.7–1.6 倍。照片占比和色条长度单独控制。
