# Chaos Jianghu Desperado's End：Twine → RPG Maker MV 移植规划（工作用）

## 1. 移植的意义与目标

### 1.1 我们在做什么
- 把 Twine 的“纯文字互动小说”改编为传统 2D RPG：有地图、有移动、有触发、有战斗/检定、有资源管理、有存档节奏。
- Twine 的最小单位是“passage 节点”；MV 的最小可玩单位是“地图 + 事件 + 对话/战斗/奖励”。

### 1.2 不是在做什么
- 不是简单把 Twine 段落塞进 MV 的对话框里。
- 不是把 Twine 变量原样照搬成一堆散落脚本变量（会失控、难维护）。

### 1.3 结果形态（可验收）
- 玩家能在地图中移动探索；靠近/交互触发事件。
- 重要剧情用对话系统呈现，分支选择能改变状态并影响后续。
- 关键节点自动存档；玩家随时可手动存档（多档位）。

## 2. 当前 MV 技术基座（已存在/已启用）

### 2.1 核心模块（Chaos 命名空间）
- 对话系统：注册表 + 运行器 + Window_Message 渲染规则  
  - 规则：`【】` 蓝色+下划线可点击；`{}` 暖黄强调无互动  
  - 位置：[ChaosDialogues.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosDialogues.js)
- 角色档案（“角色是谁”）：UID 注册表（当前内置主角 `000000`）  
  - 位置：[ChaosCharacters.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosCharacters.js)
- 角色动态数值（“角色现在怎样”）：写入 `$gameSystem`，短期沿用  
  - 位置：[ChaosCharacterStats.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosCharacterStats.js)
- 地图布局：左侧 HUD + 右上地图主视口 + 右下消息窗口  
  - 位置：[ChaosGameLayout.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosGameLayout.js)
- 开场驱动：新档进入地图自动播放开场对白 + 黑屏/雾过渡  
  - 位置：[ChaosGameIntro.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosGameIntro.js)
- 视野雾（fog）：已启用，用于实现“近处可见、远处浓雾”  
  - 位置：[ChaosVisionFog.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosVisionFog.js)

### 2.2 存档/读档（手动多档位 + 自动存档）
- 手动存档/读档：沿用 MV 原生多档位界面。
- 自动存档：额外增加一个固定槽位 `AUTO`，由系统写入，不占用玩家手动槽位。
- 实现位置：[ChaosSaveSystem.js](file:///i:/RPGmakerTools/Chaos%20JianghuDesperado's%20End/game/js/plugins/ChaosSaveSystem.js)

## 3. 存档策略（给策划/非程序员也能直接用）

### 3.1 手动存档/读档
- 玩家通过原生“保存/读取”界面操作（多档位）。

### 3.2 自动存档（插入点的标准写法）
#### A) 在地图事件里插入（推荐给非程序员）
- 事件指令 → 插件命令：
  - `CHAOS_AUTOSAVE [可选标签]`
- 例子：
  - `CHAOS_AUTOSAVE S10_A1_进入营地`
- 标签的作用：只用于日后排查“这个自动存档点是什么位置”，不影响功能。

#### B) 在对话节点里插入（给数据编写者/程序员）
- 在 `node.actions` 数组里加入：
  - `{ "type":"autoSave", "tag":"S10_A1_进入营地" }`

### 3.3 自动存档的使用建议（节奏）
- 建议放在：进入新区域、完成关键目标、Boss战前后、剧情大转折、获得关键道具/身份变化等。
- 不建议放在：每个小分支选择之后（会频繁写盘，意义不大）。

## 4. 人物规划（短期/中期）

### 4.1 人物的“分层”概念（避免混乱）
- 叙事角色（NPC）：主要出现在对话与地图事件中，不一定进入战斗队伍。
- 战斗单位：敌人使用 MV 原生 Enemies/Troops 数据；队友/主角是 Actors。
- 剧情数值：短期统一走 `ChaosCharacterStats`（不直接映射到 Actor 的 hp/mp/atk 等），等战斗体系确定后再决定是否映射。

### 4.2 UID 约定（建议）
- UID 使用 6 位字符串：`'000000'`、`'000123'`。
- 主角 UID 固定为 `000000`，ActorId 固定为 1（当前实现就是这样）。

### 4.3 新增“关键角色”（Twine 与 MV 两边都要认识的角色）标准流程
1) 在 MV 数据库 Actors 新建一个 Actor，得到 `actorId`（例如 12）。
2) 在 `ChaosCharacters` 注册角色档案（至少包含 `uid/actorId/publicName/realName`）。
3) 初始剧情数值用两种方式任选其一：
   - 推荐：用对话动作 `setCharacterStats` 或事件动作写入（未知用 -1）。
   - 兜底：保持 -1，让后续显示逻辑再决定如何初始化（需统一策略）。

### 4.4 名字显示策略
- 角色档案里维护两套名字：
  - `publicName`：对外称呼（例如“黑衣人”“道长”）
  - `realName`：真实姓名（例如“唐悠”）
- 是否对玩家展示真实名，属于剧情解锁点（可做成一个“切换显示模式”的动作/flag）。

## 5. 故事拆分（大章节/区域节点）

> 目的：把超大 Twine 故事拆成可独立搬运、可独立验收的“章节包”。

### 5.1 大章节清单（建议编号）
- S00 元信息与入口：声明/备忘录/作者信息/开始游戏入口
- S01 开场·苏醒（新手引导）：冷→感官→睁眼→我是谁→雾视野→检定教学→解锁移动
- S10 A区（A1~A4）事件链：以 `A1遭遇/棚屋/采药人/...` 为核心的一组
- S20 B区（B1~B4）事件链：以 `B1遭遇/.../B4问答` 为核心的一组
- S30 C区（C1~C4）事件链：含关键NPC、委托、推进信息
- S40 D区（D1~D4）事件链：高冲突/关键战斗/强制推进
- S90 结局与后记：所有结局入口、后记、回收文本

### 5.2 推荐搬运顺序
- S01（把玩法闭环补齐）→ S10 → S20 → S30 → S40 → S90

## 6. “地图化”改编方法（Twine → MV）

### 6.1 对应关系（核心原则）
- Twine 的“场景文字描述” → MV 的“地图地形 + 事件点 + 少量提示性文本”
- Twine 的“遭遇/进入/离开” → MV 的“进入触发/交互触发/区域出口传送”
- Twine 的“选择链接” → MV 的“对话【】选项”或“地图上多个可交互对象”
- Twine 的“变量门控（if）” → MV 的“存档状态（flag/变量）门控 + 事件页条件”

### 6.2 每个章节的交付物（验收清单）
- 地图：可走、可辨识方位与关键地标；出口能通往正确区域
- 事件：关键交互点能触发正确对话/战斗/检定
- 状态：重要分支会写入 flag/变量，并在后续体现
- 存档：关键节点自动存档至少 1 次；手动存档不被覆盖；读档能恢复状态

## 7. 下一步落地（第一个样板章）
- 以 **S10（A区：A1~A4）** 做“样板章”：
  - 先画出 A 区地图（按 Twine 描述提炼地标/路径/关键点）
  - 以 `A1遭遇` 为核心，落地一组事件：尸堆/篝火/棚屋/采药人/离开出口
  - 在“进入A区/完成A1关键节点”处插入 `CHAOS_AUTOSAVE`（便于测试与玩家体验）

