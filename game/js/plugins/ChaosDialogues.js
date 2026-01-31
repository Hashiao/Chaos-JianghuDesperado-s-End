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
        this._enterNode(windowMessage);
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
        this._applyActions(node && node.actions ? node.actions : null);
        if (windowMessage && windowMessage.chaosReplaceMessageLines) {
            windowMessage.chaosReplaceMessageLines(node.lines || []);
        } else if ($gameMessage) {
            $gameMessage.clear();
            var lines = node.lines || [];
            for (var i = 0; i < lines.length; i++) $gameMessage.add(lines[i]);
        }
    };

    DialogueRuntime.prototype._applyActions = function(actions) {
        /**
         * 参数：
         * - actions: Array<object>|null，典型值 [{type:'mainAreaOverlayMode', mode:'fog'}]
         * 返回：void
         * 操作：执行节点动作列表。内置支持 mainAreaOverlayMode；其余动作通过 emit 扩展分发。
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
            } else {
                this.emit(a.type, a);
            }
        }
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
                links: { '继续': '__END__' }
            }
        }
    });
})();
