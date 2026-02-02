/*:
 * @plugindesc Chaos Dialogue Data & Runtime
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：对话数据与运行器插件入口。提供：
     * - Chaos.Dialogues：对话脚本注册表（用 id 索引）
     * - Chaos.DialogueRuntime：运行器（负责节点跳转、点击推进、动作执行）
     * 同时扩展 Window_Message：实现【】互动（蓝色+下划线）与{}强调（暖黄偏橘，无互动）。
     */
    'use strict';

    var root = (function() {
        /**
         * 参数：无
         * 返回：object，典型值 window / global
         * 操作：获取全局对象引用（适配浏览器与NW.js环境）。
         */
        return this || (0, eval)('this');
    })();
    var Chaos = root.Chaos = root.Chaos || {};

    function ChaosDialogueRegistry() {
        /**
         * 参数：无
         * 返回：void
         * 操作：创建对话注册表实例。内部以 _byId 维护“对话ID -> 对话脚本”的映射。
         */
        this._byId = {};
    }

    ChaosDialogueRegistry.prototype.register = function(dialogue) {
        /**
         * 参数：
         * - dialogue: object，典型值 {id:'INTRO', title:'开场', nodes:{...}}
         * 返回：void
         * 操作：注册/覆盖一个对话脚本（以 dialogue.id 为唯一键）。
         */
        if (!dialogue || !dialogue.id) return;
        this._byId[String(dialogue.id)] = dialogue;
    };

    ChaosDialogueRegistry.prototype.get = function(id) {
        /**
         * 参数：
         * - id: string，典型值 'INTRO'
         * 返回：object|null，命中返回对话脚本，否则返回 null
         * 操作：按对话ID获取对话脚本。
         */
        return this._byId[String(id)] || null;
    };

    Chaos.Dialogues = Chaos.Dialogues || new ChaosDialogueRegistry();

    function ensureDialogueState() {
        /**
         * 参数：无
         * 返回：object|null，典型值 {active:true, dialogueId:'INTRO', nodeId:'COLD'}
         * 操作：确保 $gameSystem 上存在对话运行状态对象，并返回它。
         * 说明：状态持久化在存档里，便于后续扩展（例如中断恢复）。
         */
        if (!$gameSystem) return null;
        if (!$gameSystem._chaosDialogueState) {
            $gameSystem._chaosDialogueState = {
                active: false,
                dialogueId: '',
                nodeId: ''
            };
        }
        return $gameSystem._chaosDialogueState;
    }

    function ensureDialogueFlagsState() {
        /**
         * 参数：无
         * 返回：object|null，典型值 { INTRO: { fog_near:true } }
         * 操作：确保 $gameSystem 上存在“对话内标记(flags)”容器，并返回它。
         * 说明：
         * - flags 用于实现“需要先做完A+B，才出现C”的门控逻辑；
         * - 每段对话以 dialogueId 作为一级键；每个 flagName 作为二级键。
         */
        if (!$gameSystem) return null;
        if (!$gameSystem._chaosDialogueFlags) {
            $gameSystem._chaosDialogueFlags = {};
        }
        return $gameSystem._chaosDialogueFlags;
    }

    function DialogueRuntime() {
        /**
         * 参数：无
         * 返回：void
         * 操作：创建对话运行器。内部维护事件回调表 _handlers，用于扩展动作系统。
         */
        this._handlers = {};
    }

    DialogueRuntime.prototype.on = function(eventName, handler) {
        /**
         * 参数：
         * - eventName: string，典型值 'someActionType'
         * - handler: function，典型值 function(payload){...}
         * 返回：void
         * 操作：注册运行器扩展事件回调。节点 actions 中非内置动作会通过 emit 分发。
         */
        if (!eventName || !handler) return;
        if (!this._handlers[eventName]) this._handlers[eventName] = [];
        this._handlers[eventName].push(handler);
    };

    DialogueRuntime.prototype.emit = function(eventName, payload) {
        /**
         * 参数：
         * - eventName: string，典型值 'someActionType'
         * - payload: any，典型值 {type:'someActionType', ...}
         * 返回：void
         * 操作：触发事件回调列表。用于“对话节点动作系统”的可插拔扩展点。
         */
        var list = this._handlers[eventName];
        if (!list || list.length === 0) return;
        for (var i = 0; i < list.length; i++) {
            try {
                list[i](payload);
            } catch (e) {
            }
        }
    };

    DialogueRuntime.prototype.isActive = function() {
        /**
         * 参数：无
         * 返回：boolean，典型值 true/false
         * 操作：判断对话运行器是否处于“接管消息窗口输入”的激活状态。
         */
        var state = ensureDialogueState();
        return !!(state && state.active);
    };

    DialogueRuntime.prototype.state = function() {
        /**
         * 参数：无
         * 返回：object|null，典型值 {active, dialogueId, nodeId}
         * 操作：返回当前对话运行状态对象（存放于 $gameSystem）。
         */
        return ensureDialogueState();
    };

    DialogueRuntime.prototype.current = function() {
        /**
         * 参数：无
         * 返回：object|null，典型值 {script:<对话脚本>, node:<当前节点>}
         * 操作：读取当前对话脚本与节点（根据 $gameSystem._chaosDialogueState 定位）。
         */
        var state = ensureDialogueState();
        if (!state || !state.active) return null;
        var script = Chaos.Dialogues.get(state.dialogueId);
        if (!script || !script.nodes) return null;
        var node = script.nodes[state.nodeId] || null;
        if (!node) return null;
        return { script: script, node: node };
    };

    DialogueRuntime.prototype.start = function(dialogueId, nodeId, windowMessage) {
        /**
         * 参数：
         * - dialogueId: string，典型值 'INTRO'
         * - nodeId: string，典型值 'COLD'
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：void
         * 操作：启动某个对话，并进入指定节点。会立即把节点文本刷到消息窗口里。
         */
        var state = ensureDialogueState();
        if (!state) return;
        state.active = true;
        state.dialogueId = String(dialogueId || '');
        state.nodeId = String(nodeId || '');
        this._resetFlagsForDialogue(state.dialogueId);
        this._enterNode(windowMessage);
    };

    DialogueRuntime.prototype._resetFlagsForDialogue = function(dialogueId) {
        /**
         * 参数：
         * - dialogueId: string，典型值 'INTRO'
         * 返回：void
         * 操作：重置指定对话的 flags（用于从头开始一段对话，避免旧存档残留影响门控）。
         */
        var flags = ensureDialogueFlagsState();
        if (!flags) return;
        flags[String(dialogueId)] = {};
    };

    DialogueRuntime.prototype._getFlag = function(dialogueId, flagName) {
        /**
         * 参数：
         * - dialogueId: string，典型值 'INTRO'
         * - flagName: string，典型值 'fog_near'
         * 返回：boolean，典型值 true/false
         * 操作：读取某对话内的标记值；不存在则返回 false。
         */
        var flags = ensureDialogueFlagsState();
        if (!flags) return false;
        var d = flags[String(dialogueId)];
        if (!d) return false;
        return !!d[String(flagName)];
    };

    DialogueRuntime.prototype._setFlag = function(dialogueId, flagName, value) {
        /**
         * 参数：
         * - dialogueId: string，典型值 'INTRO'
         * - flagName: string，典型值 'fog_near'
         * - value: boolean，典型值 true/false
         * 返回：void
         * 操作：设置某对话内的标记值（写入存档）。
         */
        var flags = ensureDialogueFlagsState();
        if (!flags) return;
        var key = String(dialogueId);
        if (!flags[key]) flags[key] = {};
        flags[key][String(flagName)] = !!value;
    };

    DialogueRuntime.prototype._hasAllFlags = function(dialogueId, flags) {
        /**
         * 参数：
         * - dialogueId: string，典型值 'INTRO'
         * - flags: Array<string>，典型值 ['fog_near','fog_far']
         * 返回：boolean，典型值 true/false
         * 操作：判断指定 flags 是否全部为 true（用于门控跳转）。
         */
        if (!flags || flags.length === 0) return true;
        for (var i = 0; i < flags.length; i++) {
            if (!this._getFlag(dialogueId, flags[i])) return false;
        }
        return true;
    };

    DialogueRuntime.prototype.end = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：void
         * 操作：结束当前对话接管，清空对话状态，并终止/清空消息窗口显示。
         */
        var state = ensureDialogueState();
        if (!state) return;
        state.active = false;
        state.dialogueId = '';
        state.nodeId = '';
        if (windowMessage && windowMessage.terminateMessage) {
            windowMessage.terminateMessage();
        } else if ($gameMessage) {
            $gameMessage.clear();
        }
    };

    DialogueRuntime.prototype.goto = function(nodeId, windowMessage) {
        /**
         * 参数：
         * - nodeId: string，典型值 'WHO_1'
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：void
         * 操作：跳转到目标节点，并刷新消息窗口内容。
         */
        var state = ensureDialogueState();
        if (!state || !state.active) return;
        state.nodeId = String(nodeId || '');
        this._enterNode(windowMessage);
    };

    DialogueRuntime.prototype._enterNode = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：void
         * 操作：进入当前节点：先执行 actions，再刷新消息窗口 lines。
         */
        var ctx = this.current();
        if (!ctx) return;
        var node = ctx.node;

        if (node && node.gotoIfAllFlags) {
            var cond = node.gotoIfAllFlags;
            var flags = cond.flags || [];
            var target = cond.nodeId || '';
            if (target && target !== (ensureDialogueState() ? ensureDialogueState().nodeId : '') && this._hasAllFlags(ctx.script.id, flags)) {
                this.goto(target, windowMessage);
                return;
            }
        }

        this._applyActions(node && node.actions ? node.actions : null, windowMessage);
        if (windowMessage && windowMessage.chaosReplaceMessageLines) {
            windowMessage.chaosReplaceMessageLines(node.lines || []);
        } else if ($gameMessage) {
            $gameMessage.clear();
            var lines = node.lines || [];
            for (var i = 0; i < lines.length; i++) $gameMessage.add(lines[i]);
        }
    };

    DialogueRuntime.prototype._applyActions = function(actions, windowMessage) {
        /**
         * 参数：
         * - actions: Array<object>|null，典型值 [{type:'mainAreaOverlayMode', mode:'fog'}]
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：void
         * 操作：执行节点动作列表。内置支持：
         * - mainAreaOverlayMode：切换右上主区域遮罩模式
         * - setCharacterStats：写入角色动态数值（存档）
         * - setPlayerInputLocked：锁定/解锁“玩家输入移动”
         * - endDialogue：结束当前对话接管（解锁后把控制权还给地图探索）
         * 其余动作通过 emit 扩展分发。
         */
        if (!actions || actions.length === 0) return;
        for (var i = 0; i < actions.length; i++) {
            var a = actions[i];
            if (!a || !a.type) continue;
            if (a.type === 'mainAreaOverlayMode') {
                if ($gameSystem) $gameSystem._chaosMainAreaOverlayMode = a.mode || 'hidden';
                var scene = SceneManager && SceneManager._scene ? SceneManager._scene : null;
                if (scene && scene._chaosMainAreaOverlay && scene._chaosMainAreaOverlay.setMode) {
                    scene._chaosMainAreaOverlay.setMode($gameSystem._chaosMainAreaOverlayMode);
                }
            } else if (a.type === 'setCharacterStats') {
                if (root.Chaos && root.Chaos.CharacterStats && root.Chaos.CharacterStats.set) {
                    root.Chaos.CharacterStats.set(a.uid, a.stats || {});
                }
            } else if (a.type === 'setPlayerInputLocked') {
                if ($gameSystem) $gameSystem._chaosPlayerInputLocked = !!a.locked;
            } else if (a.type === 'setDialogueFlag') {
                var state = ensureDialogueState();
                if (state) {
                    this._setFlag(state.dialogueId, a.flag, a.value);
                }
            } else if (a.type === 'skillCheck') {
                var runtime = this;
                var checkSpec = a.check || {};
                var successNode = a.successNode || '';
                var failNode = a.failNode || '';
                var resolved = false;
                var onDone = function(result) {
                    if (resolved) return;
                    resolved = true;
                    if (root.Chaos && root.Chaos.DebugConsole && root.Chaos.DebugConsole.log) root.Chaos.DebugConsole.log('skillCheck done', result);
                    if (!result) return;
                    if (!runtime.isActive()) return;
                    if (result.success && successNode) {
                        runtime.goto(successNode, windowMessage || null);
                    } else if (!result.success && failNode) {
                        runtime.goto(failNode, windowMessage || null);
                    }
                };
                var fallbackResolve = function() {
                    if (resolved) return;
                    if (root.Chaos && root.Chaos.DebugConsole && root.Chaos.DebugConsole.warn) root.Chaos.DebugConsole.warn('skillCheck fallbackResolve');
                    var roll = Math.floor(Math.random() * 20) + 1;
                    var baseBonus = Number(checkSpec.baseBonus) || 0;
                    var difficulty = Number(checkSpec.difficulty) || 0;
                    var crit = '';
                    var success = false;
                    if (roll === 1) { crit = 'crit_fail'; success = false; }
                    else if (roll === 20) { crit = 'crit_success'; success = true; }
                    else { success = (roll + baseBonus) >= difficulty; }
                    onDone({ roll: roll, baseBonus: baseBonus, difficulty: difficulty, total: roll + baseBonus, success: !!success, crit: crit, type: String(checkSpec.type || '') });
                };
                try {
                    var totalFrames = (Number(checkSpec.durationFrames) || 180) + 24 + 60;
                    var timeoutMs = Math.max(1200, Math.floor((totalFrames / 60) * 1000) + 600);
                    setTimeout(function() { fallbackResolve(); }, timeoutMs);
                } catch (e) {
                }
                try {
                    if (root.Chaos && root.Chaos.Checks && root.Chaos.Checks.start) {
                        if (root.Chaos && root.Chaos.DebugConsole && root.Chaos.DebugConsole.log) root.Chaos.DebugConsole.log('skillCheck start', checkSpec);
                        var started = root.Chaos.Checks.start(checkSpec, onDone);
                        if (started === false) fallbackResolve();
                    } else {
                        this.emit('skillCheck', { type: 'skillCheck', check: checkSpec, successNode: successNode, failNode: failNode, done: onDone });
                        fallbackResolve();
                    }
                } catch (e) {
                    fallbackResolve();
                }
            } else if (a.type === 'endDialogue') {
                this.end(windowMessage || null);
            } else {
                this.emit(a.type, a);
            }
        }
    };

    var _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        /**
         * 参数：无
         * 返回：boolean，典型值 true/false
         * 操作：在原有“能否移动”判断上追加一个“玩家输入移动锁”开关。
         * 说明：
         * - locked=true 时：键盘方向键、鼠标点地移动等都会被禁用；
         * - 事件强制移动（move route forcing）不依赖 canMove，一般仍可正常执行。
         */
        if ($gameSystem && $gameSystem._chaosPlayerInputLocked) return false;
        return _Game_Player_canMove.call(this);
    };

    DialogueRuntime.prototype.handleMessageClick = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * 返回：boolean，true 表示已处理本次点击（用于拦截默认消息输入）
         * 操作：处理“点击对话框任意位置推进”的逻辑：若当前节点配置了 nextOnClick 则跳转。
         */
        var ctx = this.current();
        if (!ctx) return false;
        var node = ctx.node;
        if (node && node.nextOnClick) {
            this.goto(node.nextOnClick, windowMessage);
            return true;
        }
        return false;
    };

    DialogueRuntime.prototype.handleLinkClick = function(windowMessage, linkText) {
        /**
         * 参数：
         * - windowMessage: Window_Message|null，典型值 Scene_Map._messageWindow
         * - linkText: string，典型值 '继续'
         * 返回：boolean，true 表示已处理该链接点击
         * 操作：处理【】链接点击：根据当前节点 links 映射跳转到目标节点或结束对话。
         */
        var ctx = this.current();
        if (!ctx) return false;
        var node = ctx.node;
        var links = node && node.links ? node.links : null;
        if (!links) return false;
        var next = links[String(linkText)];
        if (!next) return false;
        if (next === '__END__') {
            this.end(windowMessage);
            return true;
        }
        this.goto(next, windowMessage);
        return true;
    };

    Chaos.DialogueRuntime = Chaos.DialogueRuntime || new DialogueRuntime();

    function ensureTextState(textState) {
        /**
         * 参数：
         * - textState: object，典型值 Window_Message 绘制文本时的状态对象
         * 返回：void
         * 操作：确保 textState 上存在本插件所需字段（链接/强调状态与坐标缓存）。
         */
        if (!textState._chaosLinkActive) textState._chaosLinkActive = false;
        if (typeof textState._chaosLinkText !== 'string') textState._chaosLinkText = '';
        if (typeof textState._chaosLinkMinX !== 'number') textState._chaosLinkMinX = 0;
        if (typeof textState._chaosLinkMaxX !== 'number') textState._chaosLinkMaxX = 0;
        if (typeof textState._chaosLinkY !== 'number') textState._chaosLinkY = 0;
        if (typeof textState._chaosEmphasisActive !== 'boolean') textState._chaosEmphasisActive = false;
    }

    function isInLink(textState) {
        /**
         * 参数：
         * - textState: object，典型值 Window_Message 绘制文本状态
         * 返回：boolean，典型值 true/false
         * 操作：判断当前是否处于【】链接绘制状态。
         */
        return !!(textState && textState._chaosLinkActive);
    }

    Window_Message.prototype.chaosClearLinks = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：清空当前消息窗口的链接区域缓存（用于点击命中测试）。
         */
        this._chaosLinks = [];
    };

    Window_Message.prototype.chaosAddLinkRect = function(linkText, x, y, w, h) {
        /**
         * 参数：
         * - linkText: string，典型值 '继续'（不包含括号）
         * - x: number，典型值 200（窗口本地坐标）
         * - y: number，典型值 64（窗口本地坐标）
         * - w: number，典型值 80（像素宽）
         * - h: number，典型值 lineHeight（像素高）
         * 返回：void
         * 操作：记录一个可点击链接的矩形区域，用于后续命中判断。
         */
        if (!this._chaosLinks) this._chaosLinks = [];
        this._chaosLinks.push({ text: linkText, x: x, y: y, w: w, h: h });
    };

    Window_Message.prototype.chaosHitTestLink = function(localX, localY) {
        /**
         * 参数：
         * - localX: number，典型值 canvasToLocalX(TouchInput.x)
         * - localY: number，典型值 canvasToLocalY(TouchInput.y)
         * 返回：string|null，命中返回 linkText，否则返回 null
         * 操作：在已记录的链接区域中进行点击命中测试。
         */
        if (!this._chaosLinks || this._chaosLinks.length === 0) return null;
        for (var i = 0; i < this._chaosLinks.length; i++) {
            var r = this._chaosLinks[i];
            if (localX >= r.x && localX < r.x + r.w && localY >= r.y && localY < r.y + r.h) return r.text;
        }
        return null;
    };

    Window_Message.prototype.chaosMaxVisibleLines = function() {
        /**
         * 参数：无
         * 返回：number，典型值 3~6
         * 操作：根据当前消息窗口内容区域高度估算可见行数（用于“超出则顶掉旧文字”）。
         */
        var lh = this.lineHeight();
        if (lh <= 0) return 4;
        return Math.max(1, Math.floor(this.contentsHeight() / lh));
    };

    Window_Message.prototype.chaosReplaceMessageLines = function(lines) {
        /**
         * 参数：
         * - lines: Array<string>，典型值 ['第一行', '第二行', ...]
         * 返回：void
         * 操作：立即替换当前消息窗口显示内容；若行数过多则保留最后 N 行模拟“顶掉旧文字”。
         */
        if (!$gameMessage) return;
        this.pause = false;
        this._textState = null;
        this._showFast = false;
        this._lineShowFast = false;
        this.chaosClearLinks();

        var maxLines = this.chaosMaxVisibleLines();
        var trimmed = lines || [];
        if (trimmed.length > maxLines) trimmed = trimmed.slice(trimmed.length - maxLines);

        $gameMessage.clear();
        for (var i = 0; i < trimmed.length; i++) $gameMessage.add(trimmed[i]);
        this.startMessage();
    };

    var _Window_Message_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        /**
         * 参数：
         * - textState: object，典型值 Window_Message 文本状态
         * 返回：void
         * 操作：开始新页时清空链接区域缓存，避免上一页残留的点击区域影响本页。
         */
        this.chaosClearLinks();
        _Window_Message_newPage.call(this, textState);
    };

    var UI_CONFIG = {
        interactiveColor: '#66aaff',
        emphasisColor: '#f2c15a',
        underlineHeight: 2,
        underlineOffsetY: 4
    };

    var _Window_Message_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
    Window_Message.prototype.processNormalCharacter = function(textState) {
        /**
         * 参数：
         * - textState: object，典型值 {text,index,x,y,...}
         * 返回：void
         * 操作：
         * - 解析并绘制【】：蓝色+下划线，并记录可点击区域（仅括号内文字可点）
         * - 解析并绘制{}：暖黄色（偏橘），仅强调（括号本身不显示、不可点击）
         */
        ensureTextState(textState);
        var c = textState.text[textState.index];

        var padding = this.standardPadding();
        var x1 = padding + textState.x;
        var y1 = padding + textState.y;
        var w = this.textWidth(c);
        var h = this.lineHeight();

        if (c === '{') {
            textState._chaosEmphasisActive = true;
            textState.index++;
            return;
        }
        if (c === '}') {
            textState._chaosEmphasisActive = false;
            textState.index++;
            return;
        }

        if (c === '【') {
            textState._chaosLinkActive = true;
            textState._chaosLinkText = '';
            textState._chaosLinkMinX = x1 + w;
            textState._chaosLinkMaxX = x1 + w;
            textState._chaosLinkY = y1;
        }

        if (isInLink(textState)) {
            this.changeTextColor(UI_CONFIG.interactiveColor);
            if (c !== '【' && c !== '】') textState._chaosLinkText += c;
        } else if (textState._chaosEmphasisActive) {
            this.changeTextColor(UI_CONFIG.emphasisColor);
        } else {
            this.resetTextColor();
        }

        _Window_Message_processNormalCharacter.call(this, textState);

        if (isInLink(textState)) {
            if (c !== '】') textState._chaosLinkMaxX = Math.max(textState._chaosLinkMaxX, x1 + w);
        }

        if (c === '】' && isInLink(textState)) {
            var linkText = textState._chaosLinkText;
            if (linkText && linkText.length > 0) {
                var endX = x1;
                var minX = textState._chaosLinkMinX;
                var maxX = Math.max(minX, endX);
                var linkW = maxX - minX;
                this.chaosAddLinkRect(linkText, minX, textState._chaosLinkY, linkW, h);
                var ux = minX - padding;
                var uy = (textState._chaosLinkY - padding) + h - UI_CONFIG.underlineOffsetY;
                this.contents.fillRect(ux, uy, linkW, UI_CONFIG.underlineHeight, UI_CONFIG.interactiveColor);
            }
            textState._chaosLinkActive = false;
            textState._chaosLinkText = '';
            this.resetTextColor();
        }
    };

    var _Window_Message_updateInput = Window_Message.prototype.updateInput;
    Window_Message.prototype.updateInput = function() {
        /**
         * 参数：无
         * 返回：boolean，true 表示本帧已处理输入（拦截默认消息输入）
         * 操作：当对话运行器处于 active 状态时，优先处理：
         * - 鼠标/触控点击【】链接
         * - 点击对话框推进 nextOnClick
         * - 键盘 OK/Cancel 默认触发第一条【】链接（若存在）
         */
        if (this.pause && !this.isAnySubWindowActive()) {
            var runtime = Chaos.DialogueRuntime;
            if (runtime && runtime.isActive()) {
                var touch = TouchInput.isTriggered();
                var keyOk = Input.isTriggered('ok');
                var keyCancel = Input.isTriggered('cancel');
                if (touch || keyOk || keyCancel) {
                    var link = null;
                    if (touch) {
                        var x = this.canvasToLocalX(TouchInput.x);
                        var y = this.canvasToLocalY(TouchInput.y);
                        link = this.chaosHitTestLink(x, y);
                        if (link) {
                            if (runtime.handleLinkClick(this, link)) return true;
                            return true;
                        }
                        if (runtime.handleMessageClick(this)) return true;
                        return true;
                    }
                    if ((keyOk || keyCancel) && this._chaosLinks && this._chaosLinks.length > 0) {
                        link = this._chaosLinks[0].text;
                        if (runtime.handleLinkClick(this, link)) return true;
                        return true;
                    }
                    if (runtime.handleMessageClick(this)) return true;
                    return true;
                }
            }
        }
        return _Window_Message_updateInput.call(this);
    };

    Chaos.Dialogues.register({
        id: 'INTRO',
        title: '开场',
        description: '开场引导对白（右侧主区域黑屏->雾）',
        defaultSpeakerUid: '000000',
        nodes: {
            COLD: {
                title: '寒冷',
                speakerUid: '000000',
                description: '主角意识恢复',
                lines: [
                    '冷，刺骨的寒冷',
                    '这是当你掌握意识时的唯一感觉。',
                    '【嘶……头好痛，好像被人敲了一棍】'
                ],
                links: { '嘶……头好痛，好像被人敲了一棍': 'SENSE' }
            },
            SENSE: {
                title: '感官',
                speakerUid: '000000',
                description: '点击对话框推进',
                lines: [
                    '生存的本能促使你调动身体的每一寸感官，誓要挣扎出这片荒凉之境。',
                    '你逐渐感受到，冰冷湿润的触感在脸颊上扩散'
                ],
                nextOnClick: 'STINK'
            },
            STINK: {
                title: '醒来',
                speakerUid: '000000',
                description: '出现“尝试睁开眼睛”互动',
                lines: [
                    '酸臭的气味不停地冲击着鼻腔，四肢的神经与大脑一一接轨，',
                    '身体每一个细胞都在焦急难耐地喊道——醒来！醒来！',
                    '【尝试睁开眼睛】'
                ],
                links: { '尝试睁开眼睛': 'OPEN_EYES' }
            },
            OPEN_EYES: {
                title: '睁眼',
                speakerUid: '000000',
                description: '进入雾化遮罩并出现“我是谁”互动',
                actions: [ { type: 'mainAreaOverlayMode', mode: 'fade_to_fog' } ],
                lines: [
                    '你缓缓地睁开双眼，灼热的光芒刺进眼球，驱散藏在眼睛里的黑暗。',
                    '你发现自己躺在一片湿润、糜烂的泥地上。',
                    '【我……我是谁？】'
                ],
                links: { '我……我是谁？': 'WHO_1' }
            },
            WHO_1: {
                title: '我是谁-1',
                speakerUid: '000000',
                description: '点击对话框推进',
                lines: [
                    '我是谁？',
                    '光是短短的三个字，就已经令你那乱成线团的脑袋变得更加杂乱。'
                ],
                nextOnClick: 'WHO_2'
            },
            WHO_2: {
                title: '我是谁-2',
                speakerUid: '000000',
                description: '点击对话框推进',
                lines: [
                    '你控制着思绪躲过一条条打结的神经，从那细枝末节中找到了一缕记忆……',
                    '想起来了，'
                ],
                nextOnClick: 'WHO_3'
            },
            WHO_3: {
                title: '我是谁-3',
                speakerUid: '000000',
                description: '出现【继续】互动；后续内容暂时搁置',
                lines: [
                    '你是百姓口中的侠士，{一名路见不平愤然出手的侠客}，',
                    '你的名字是……嘶……想不起来了……',
                    '【继续】'
                ],
                links: { '继续': 'REMEMBER_1' }
            },
            REMEMBER_1: {
                title: '记忆解封-1',
                speakerUid: '000000',
                description: '点击继续后：更新主角命中/防御/闪避/格挡，并展示第一段新对白',
                actions: [
                    { type: 'setCharacterStats', uid: '000000', stats: { hit: 3, def: 4, eva: 11, blk: 5 } }
                ],
                lines: [
                    '随着记忆的解封，你逐渐想起，',
                    '这里应该是一处名叫麒麟山的地方，'
                ],
                nextOnClick: 'REMEMBER_2'
            },
            REMEMBER_2: {
                title: '记忆解封-2',
                speakerUid: '000000',
                description: '点击对话框推进至选项页',
                lines: [
                    '你受村民所托，于八月初十日上山寻找她那失踪的丈夫——一名资深的采药人。',
                    '然而，当你在树林中兜兜转转四处寻觅之时，',
                    '突然感觉到一股劲风从身后袭来,',
                    '',
                    '之后便是两眼一黑……直到现在醒来。',
                    '此刻，趴在地上的你感受地面传来阵阵阴冷，似乎在提醒着你：该动起来了。'
                ],
                nextOnClick: 'CHOICE_1'
            },
            CHOICE_1: {
                title: '选择-1',
                speakerUid: '000000',
                description: '出现三个可点击选项；目前分支内容暂未编写（按约定保持可点但不推进主线）',
                lines: [
                    '【检查身体】  【观察四周】  【爬起来】'
                ],
                links: {
                    '检查身体': 'CHOICE_CHECK_BODY',
                    '观察四周': 'CHOICE_LOOK_AROUND',
                    '爬起来': 'GET_UP_1'
                }
            },
            CHOICE_CHECK_BODY: {
                title: '选择-检查身体',
                speakerUid: '000000',
                description: '分支内容占位；提示暂未实现并返回选项页',
                lines: [
                    '你感觉四肢软趴趴的，尝试着握了握拳头，却怎么也使不上劲。',
                    '【返回】'
                ],
                links: { '返回': 'CHOICE_1' }
            },
            CHOICE_LOOK_AROUND: {
                title: '选择-观察四周',
                speakerUid: '000000',
                description: '分支内容占位；提示暂未实现并返回选项页',
                lines: [
                    '由于趴在地上，你只能侧着脸看向一侧',
                    '你发现四周充斥着浓密的白雾，',
                    '【返回】'
                ],
                links: { '返回': 'CHOICE_1' }
            },
            GET_UP_1: {
                title: '爬起来-1',
                speakerUid: '000000',
                description: '爬起来后的第一段文字；点击对话框推进',
                lines: [
                    '你双手撑地，弓起身，慢慢地爬了起来。',
                    '你发现自己站在白茫茫的迷雾之中。'
                ],
                nextOnClick: 'GET_UP_2'
            },
            GET_UP_2: {
                title: '爬起来-2',
                speakerUid: '000000',
                description: '对白说明迷雾视野；点击对话框推进到“5米内/外”选项',
                lines: [
                    '这白雾有点诡异，你仅能清晰看见约5米内的事物，超出5米开外的景色便模糊不清。不过当你凝神时，视野稍微变远了些——看来修为越高，受到的视野压制便越低，对普通人来说估计看清3米内已是极限'
                ],
                nextOnClick: 'FOG_QUERY'
            },
            FOG_QUERY: {
                title: '迷雾探查-选择',
                speakerUid: '000000',
                description: '出现“5米内/外”两个选项；两者都点过后自动进入“技能检定选项”页',
                gotoIfAllFlags: { flags: ['fog_near_done', 'fog_far_done'], nodeId: 'FOG_DONE' },
                lines: [
                    '【5米内有什么？】【5米外呢？】'
                ],
                links: {
                    '5米内有什么？': 'FOG_NEAR',
                    '5米外呢？': 'FOG_FAR'
                }
            },
            FOG_NEAR: {
                title: '迷雾探查-5米内',
                speakerUid: '000000',
                description: '查看5米内信息；标记完成并返回选择页',
                actions: [
                    { type: 'setDialogueFlag', flag: 'fog_near_done', value: true }
                ],
                lines: [
                    '除了你刚刚趴着的地方的草丛被压塌了之外，附近都布满了脚踝高的草丛，似乎没什么值得注意的。',
                    '【返回】'
                ],
                links: { '返回': 'FOG_QUERY' }
            },
            FOG_FAR: {
                title: '迷雾探查-5米外',
                speakerUid: '000000',
                description: '查看5米外信息；标记完成并返回选择页',
                actions: [
                    { type: 'setDialogueFlag', flag: 'fog_far_done', value: true }
                ],
                lines: [
                    '你仅能依稀看出周遭是一片茂密的树林，似乎你还在麒麟山上？',
                    '【返回】'
                ],
                links: { '返回': 'FOG_QUERY' }
            },
            FOG_DONE: {
                title: '迷雾探查-完成',
                speakerUid: '000000',
                description: '5米内外均探查后显示技能检定选项；检定逻辑暂留空',
                lines: [
                    '你屏住呼吸，尝试在白雾里分辨更多线索。',
                    '{难度8}',
                    '{加成1: 鹰隼之眼 +4}',
                    '【进行检定】'
                ],
                links: {
                    '进行检定': 'CHECK_PERCEPTION_1'
                }
            },
            CHECK_PERCEPTION_1: {
                title: '检定-感知',
                speakerUid: '000000',
                description: '第一次检定：感知检定（鹰隼之眼+4，难度8）',
                actions: [
                    { type: 'skillCheck', check: { type: 'per', difficulty: 8, baseBonus: 4, bonusName: '鹰隼之眼' }, successNode: 'CHECK_PERCEPTION_1_OK', failNode: 'CHECK_PERCEPTION_1_FAIL' }
                ],
                lines: [
                    '{（感知检定中……）}'
                ]
            },
            CHECK_PERCEPTION_1_OK: {
                title: '检定-成功',
                speakerUid: '000000',
                description: '感知检定成功：发现草药',
                lines: [
                    '你发现几株翠绿的草药在杂草中若隐若现。',
                    '久经江湖的你轻易认出这是一种常见的、具有养血活血功效的药材。',
                    '【采集药草】'
                ],
                links: { '采集药草': 'CHECK_PERCEPTION_1_COLLECT_PLACEHOLDER' }
            },
            CHECK_PERCEPTION_1_COLLECT_PLACEHOLDER: {
                title: '采集-占位',
                speakerUid: '000000',
                description: '采集逻辑暂留空',
                lines: [
                    '{（采集逻辑暂未实现）}',
                    '【开始探索】'
                ],
                links: { '开始探索': 'END_TO_EXPLORE' }
            },
            CHECK_PERCEPTION_1_FAIL: {
                title: '检定-失败',
                speakerUid: '000000',
                description: '感知检定失败：没有发现',
                lines: [
                    '你四处张望，此处没什么特别的地方了。',
                    '【开始探索】'
                ],
                links: { '开始探索': 'END_TO_EXPLORE' }
            },
            END_TO_EXPLORE: {
                title: '结束开场-进入探索',
                speakerUid: '000000',
                description: '解锁玩家移动并结束对话接管，进入地图探索阶段',
                actions: [
                    { type: 'setPlayerInputLocked', locked: false },
                    { type: 'autoSave', tag: 'S01_解锁移动_进入探索' }
                ],
                lines: [
                    '你深吸一口气，强迫自己冷静下来。',
                    '现在要做的，是在这片白雾里活下去，并找到摆脱蛊虫的方法。',
                    '（你可以开始移动探索了）',
                    '【开始探索】'
                ],
                links: { '开始探索': '__END__' }
            }
        }
    });
})();
