/*:
 * @plugindesc Chaos Dialogue Data & Runtime
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    'use strict';

    var root = (function() { return this || (0, eval)('this'); })();
    var Chaos = root.Chaos = root.Chaos || {};

    function ChaosDialogueRegistry() {
        this._byId = {};
    }

    ChaosDialogueRegistry.prototype.register = function(dialogue) {
        if (!dialogue || !dialogue.id) return;
        this._byId[String(dialogue.id)] = dialogue;
    };

    ChaosDialogueRegistry.prototype.get = function(id) {
        return this._byId[String(id)] || null;
    };

    Chaos.Dialogues = Chaos.Dialogues || new ChaosDialogueRegistry();

    function ensureDialogueState() {
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
        this._handlers = {};
    }

    DialogueRuntime.prototype.on = function(eventName, handler) {
        if (!eventName || !handler) return;
        if (!this._handlers[eventName]) this._handlers[eventName] = [];
        this._handlers[eventName].push(handler);
    };

    DialogueRuntime.prototype.emit = function(eventName, payload) {
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
        var state = ensureDialogueState();
        return !!(state && state.active);
    };

    DialogueRuntime.prototype.state = function() {
        return ensureDialogueState();
    };

    DialogueRuntime.prototype.current = function() {
        var state = ensureDialogueState();
        if (!state || !state.active) return null;
        var script = Chaos.Dialogues.get(state.dialogueId);
        if (!script || !script.nodes) return null;
        var node = script.nodes[state.nodeId] || null;
        if (!node) return null;
        return { script: script, node: node };
    };

    DialogueRuntime.prototype.start = function(dialogueId, nodeId, windowMessage) {
        var state = ensureDialogueState();
        if (!state) return;
        state.active = true;
        state.dialogueId = String(dialogueId || '');
        state.nodeId = String(nodeId || '');
        this._enterNode(windowMessage);
    };

    DialogueRuntime.prototype.end = function(windowMessage) {
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
        var state = ensureDialogueState();
        if (!state || !state.active) return;
        state.nodeId = String(nodeId || '');
        this._enterNode(windowMessage);
    };

    DialogueRuntime.prototype._enterNode = function(windowMessage) {
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
        if (!textState._chaosLinkActive) textState._chaosLinkActive = false;
        if (typeof textState._chaosLinkText !== 'string') textState._chaosLinkText = '';
        if (typeof textState._chaosLinkMinX !== 'number') textState._chaosLinkMinX = 0;
        if (typeof textState._chaosLinkMaxX !== 'number') textState._chaosLinkMaxX = 0;
        if (typeof textState._chaosLinkY !== 'number') textState._chaosLinkY = 0;
        if (typeof textState._chaosEmphasisActive !== 'boolean') textState._chaosEmphasisActive = false;
    }

    function isInLink(textState) {
        return !!(textState && textState._chaosLinkActive);
    }

    Window_Message.prototype.chaosClearLinks = function() {
        this._chaosLinks = [];
    };

    Window_Message.prototype.chaosAddLinkRect = function(linkText, x, y, w, h) {
        if (!this._chaosLinks) this._chaosLinks = [];
        this._chaosLinks.push({ text: linkText, x: x, y: y, w: w, h: h });
    };

    Window_Message.prototype.chaosHitTestLink = function(localX, localY) {
        if (!this._chaosLinks || this._chaosLinks.length === 0) return null;
        for (var i = 0; i < this._chaosLinks.length; i++) {
            var r = this._chaosLinks[i];
            if (localX >= r.x && localX < r.x + r.w && localY >= r.y && localY < r.y + r.h) return r.text;
        }
        return null;
    };

    Window_Message.prototype.chaosMaxVisibleLines = function() {
        var lh = this.lineHeight();
        if (lh <= 0) return 4;
        return Math.max(1, Math.floor(this.contentsHeight() / lh));
    };

    Window_Message.prototype.chaosReplaceMessageLines = function(lines) {
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

