(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：RPG Maker MV 插件入口：实现“进入地图后游戏主区域黑屏”和“开场对白自动播放”。
     */
    'use strict';

    var CHAOS_INTRO_CONFIG = {
        sidebarWidth: 360,
        messageHeightRate: 0.25,
        overlayColor: '#000000',
        overlayOpacity: 255,
        enableBlackMainArea: true,
        interactiveColor: '#66aaff',
        emphasisColor: '#f2c15a',
        fogTint: 0x808080,
        fogOpacity: 160,
        fogFadeFrames: 70,
        underlineHeight: 2,
        underlineOffsetY: 4,
        singleActorOnly: true
    };

    function chaosRightPaneX() {
        /**
         * 参数：无
         * 返回：number，典型值 360
         * 操作：计算右侧主区域起始x。
         */
        return CHAOS_INTRO_CONFIG.sidebarWidth;
    }

    function chaosRightPaneWidth() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.width - 360（如 1240）
         * 操作：计算右侧主区域宽度。
         */
        return Graphics.width - CHAOS_INTRO_CONFIG.sidebarWidth;
    }

    function chaosMessageHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 floor(Graphics.height * 0.25)（如 225）
         * 操作：计算底部对话框区域高度。
         */
        return Math.floor(Graphics.height * CHAOS_INTRO_CONFIG.messageHeightRate);
    }

    function chaosMainAreaHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.height - messageHeight（如 675）
         * 操作：计算“游戏主区域”的高度（对话框之上区域）。
         */
        return Graphics.height - chaosMessageHeight();
    }

    function ChaosMainAreaOverlay() {
        /**
         * 参数：无
         * 返回：void
         * 操作：黑屏遮罩控制器构造器（封装遮罩的创建/更新/销毁）。
         */
        this.initialize.apply(this, arguments);
    }

    ChaosMainAreaOverlay.prototype.initialize = function(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值为当前地图场景 this
         * 返回：void
         * 操作：绑定地图场景，并初始化遮罩精灵引用（尚未创建位图）。
         */
        this._sceneMap = sceneMap;
        this._sprite = null;
        this._lastW = 0;
        this._lastH = 0;
        this._fadeFromTint = 0x000000;
        this._fadeToTint = CHAOS_INTRO_CONFIG.fogTint;
        this._fadeFromOpacity = CHAOS_INTRO_CONFIG.overlayOpacity;
        this._fadeToOpacity = CHAOS_INTRO_CONFIG.fogOpacity;
        this._fadeFrames = CHAOS_INTRO_CONFIG.fogFadeFrames;
        this._fadeIndex = 0;
        this._mode = 'hidden';
    };

    ChaosMainAreaOverlay.prototype.ensure = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：确保遮罩精灵存在且尺寸匹配当前分辨率；将其放置到右上“游戏主区域”。
         */
        if (!this._sceneMap) return;
        var w = chaosRightPaneWidth();
        var h = chaosMainAreaHeight();
        if (!this._sprite || this._lastW !== w || this._lastH !== h) {
            this._lastW = w;
            this._lastH = h;
            var bmp = new Bitmap(w, h);
            bmp.fillRect(0, 0, w, h, '#ffffff');
            var spr = new Sprite(bmp);
            spr.opacity = CHAOS_INTRO_CONFIG.overlayOpacity;
            spr.tint = 0x000000;
            spr.x = chaosRightPaneX();
            spr.y = 0;
            this._sprite = spr;

            var idx = 0;
            if (this._sceneMap._windowLayer) idx = this._sceneMap.getChildIndex(this._sceneMap._windowLayer);
            this._sceneMap.addChildAt(this._sprite, idx);
        } else {
            this._sprite.x = chaosRightPaneX();
            this._sprite.y = 0;
            this._sprite.opacity = this._sprite.opacity;
        }
    };

    ChaosMainAreaOverlay.prototype.setVisible = function(visible) {
        /**
         * 参数：
         * - visible: boolean，典型值 true/false
         * 返回：void
         * 操作：设置遮罩显示/隐藏；若遮罩尚未创建，会先创建。
         */
        if (visible) this.ensure();
        if (this._sprite) this._sprite.visible = !!visible;
    };

    ChaosMainAreaOverlay.prototype.setMode = function(mode) {
        /**
         * 参数：
         * - mode: string，典型值 'hidden'|'black'|'fade_to_fog'|'fog'
         * 返回：void
         * 操作：设置遮罩模式；fade_to_fog 会自动推进为 fog。
         */
        var next = mode || 'hidden';
        if (this._mode === next && next !== 'hidden') {
            this.ensure();
            this.setVisible(true);
            return;
        }
        this._mode = next;
        if (this._mode === 'hidden') {
            this.setVisible(false);
            return;
        }
        this.ensure();
        this.setVisible(true);
        if (!this._sprite) return;

        if (this._mode === 'black') {
            this._sprite.tint = 0x000000;
            this._sprite.opacity = CHAOS_INTRO_CONFIG.overlayOpacity;
            this._fadeIndex = 0;
        } else if (this._mode === 'fog') {
            this._sprite.tint = CHAOS_INTRO_CONFIG.fogTint;
            this._sprite.opacity = CHAOS_INTRO_CONFIG.fogOpacity;
            this._fadeIndex = 0;
        } else if (this._mode === 'fade_to_fog') {
            this._fadeFromTint = 0x000000;
            this._fadeToTint = CHAOS_INTRO_CONFIG.fogTint;
            this._fadeFromOpacity = CHAOS_INTRO_CONFIG.overlayOpacity;
            this._fadeToOpacity = CHAOS_INTRO_CONFIG.fogOpacity;
            this._fadeFrames = Math.max(1, CHAOS_INTRO_CONFIG.fogFadeFrames);
            this._fadeIndex = 0;
            this._sprite.tint = this._fadeFromTint;
            this._sprite.opacity = this._fadeFromOpacity;
        }
    };

    ChaosMainAreaOverlay.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：每帧推进遮罩动画（目前仅支持 black -> fog 的渐变）。
         */
        if (!this._sprite || !this._sprite.visible) return;
        if (this._mode !== 'fade_to_fog') return;

        this._fadeIndex++;
        var t = Math.min(1, this._fadeIndex / this._fadeFrames);
        var opacity = Math.round(this._fadeFromOpacity + (this._fadeToOpacity - this._fadeFromOpacity) * t);
        this._sprite.opacity = opacity;
        var shade = Math.round(0 + (128 - 0) * t);
        this._sprite.tint = (shade << 16) | (shade << 8) | shade;

        if (t >= 1) {
            this._sprite.tint = this._fadeToTint;
            this._mode = 'fog';
            if ($gameSystem) $gameSystem._chaosMainAreaOverlayMode = 'fog';
        }
    };

    function ChaosGameIntro() {
        /**
         * 参数：无
         * 返回：void
         * 操作：开场对白控制器构造器（封装“只触发一次”的逻辑与互动对白流程）。
         */
        this.initialize.apply(this, arguments);
    }

    ChaosGameIntro.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：初始化控制器；本控制器本身无状态，状态持久化放在 $gameSystem 中。
         */
    };

    ChaosGameIntro.prototype.begin = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message | null，典型值为当前消息窗口实例
         * 返回：void
         * 操作：初始化开场互动流程，并显示第一屏对白（包含可点击的【】选项）。
         */
        if (!$gameSystem) return;
        $gameSystem._chaosIntroStep = 0;
        $gameSystem._chaosIntroActive = true;
        this.showStep(windowMessage, 0);
    };

    ChaosGameIntro.prototype.shouldPlay = function() {
        /**
         * 参数：无
         * 返回：boolean，典型值 true/false
         * 操作：判断当前是否需要播放开场对白（新游戏首次进入地图时播放一次）。
         */
        return $gameSystem && !$gameSystem._chaosIntroPlayed;
    };

    ChaosGameIntro.prototype.play = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message | null，典型值为当前消息窗口实例
         * 返回：void
         * 操作：播放开场第一屏；该方法保留为兼容入口，内部走 begin()。
         */
        this.begin(windowMessage);
    };

    ChaosGameIntro.prototype.isActive = function() {
        /**
         * 参数：无
         * 返回：boolean，典型值 true/false
         * 操作：判断开场互动流程是否处于激活状态。
         */
        return !!($gameSystem && $gameSystem._chaosIntroActive);
    };

    ChaosGameIntro.prototype.currentStep = function() {
        /**
         * 参数：无
         * 返回：number，典型值 0/1/2/3/4/5/6
         * 操作：读取当前开场步骤；未初始化时返回 -1。
         */
        if (!$gameSystem || typeof $gameSystem._chaosIntroStep !== 'number') return -1;
        return $gameSystem._chaosIntroStep;
    };

    ChaosGameIntro.prototype.showStep = function(windowMessage, step) {
        /**
         * 参数：
         * - windowMessage: Window_Message | null，典型值为当前消息窗口实例
         * - step:number 典型值 0/1/2
         * 返回：void
         * 操作：按步骤替换消息窗口内容；若内容过多会自动截取最后若干行以“顶掉旧文字”。
         */
        if (!$gameSystem) return;
        if (!windowMessage || !windowMessage.chaosReplaceMessageLines) {
            this.enqueueStepLines(step);
            return;
        }
        windowMessage.chaosReplaceMessageLines(this.stepLines(step));
    };

    ChaosGameIntro.prototype.enqueueStepLines = function(step) {
        /**
         * 参数：
         * - step:number 典型值 0/1/2
         * 返回：void
         * 操作：将步骤文本加入消息队列（不强制立即刷新窗口）；用于窗口尚未就绪的兜底。
         */
        if (!$gameMessage) return;
        $gameMessage.clear();
        var lines = this.stepLines(step);
        for (var i = 0; i < lines.length; i++) $gameMessage.add(lines[i]);
    };

    ChaosGameIntro.prototype.stepLines = function(step) {
        /**
         * 参数：
         * - step:number 典型值 0/1/2
         * 返回：Array<string>，每个元素是一行文本
         * 操作：定义开场互动对白的分步内容。
         */
        if (step === 0) {
            return [
                '冷，刺骨的寒冷',
                '这是当你掌握意识时的唯一感觉。',
                '【嘶……头好痛，好像被人敲了一棍】'
            ];
        } else if (step === 1) {
            return [
                '生存的本能促使你调动身体的每一寸感官，誓要挣扎出这片荒凉之境。',
                '你逐渐感受到，冰冷湿润的触感在脸颊上扩散'
            ];
        } else if (step === 2) {
            return [
                '酸臭的气味不停地冲击着鼻腔，四肢的神经与大脑一一接轨，',
                '身体每一个细胞都在焦急难耐地喊道——醒来！醒来！',
                '【尝试睁开眼睛】'
            ];
        } else if (step === 3) {
            return [
                '你缓缓地睁开双眼，灼热的光芒刺进眼球，驱散藏在眼睛里的黑暗。',
                '你发现自己躺在一片湿润、糜烂的泥地上。',
                '【我……我是谁？】'
            ];
        } else if (step === 4) {
            return [
                '我是谁？',
                '光是短短的三个字，就已经令你那乱成线团的脑袋变得更加杂乱。'
            ];
        } else if (step === 5) {
            return [
                '你控制着思绪躲过一条条打结的神经，从那细枝末节中找到了一缕记忆……',
                '想起来了，'
            ];
        } else if (step === 6) {
            return [
                '你是百姓口中的侠士，{一名路见不平愤然出手的侠客}，',
                '你的名字是……嘶……想不起来了……',
                '【继续】'
            ];
        }
        return [];
    };

    ChaosGameIntro.prototype.onLinkClicked = function(windowMessage, linkText) {
        /**
         * 参数：
         * - windowMessage: Window_Message | null，典型值为当前消息窗口实例
         * - linkText:string 典型值 “嘶……头好痛，好像被人敲了一棍” 或 “尝试睁开眼睛”
         * 返回：boolean，true 表示已处理该点击
         * 操作：处理【】选项的点击，根据当前步骤切换对白或触发后续动作。
         */
        if (!$gameSystem || !this.isActive()) return false;
        var step = this.currentStep();
        if (step === 0 && linkText === '嘶……头好痛，好像被人敲了一棍') {
            $gameSystem._chaosIntroStep = 1;
            this.showStep(windowMessage, 1);
            return true;
        }
        if (step === 2 && linkText === '尝试睁开眼睛') {
            $gameSystem._chaosIntroStep = 3;
            $gameSystem._chaosIntroActive = true;
            $gameSystem._chaosMainAreaOverlayMode = 'fade_to_fog';
            this.showStep(windowMessage, 3);
            var scene = SceneManager && SceneManager._scene ? SceneManager._scene : null;
            if (scene && scene._chaosMainAreaOverlay && scene._chaosMainAreaOverlay.setMode) {
                scene._chaosMainAreaOverlay.setMode('fade_to_fog');
            }
            return true;
        }
        if (step === 3 && linkText === '我……我是谁？') {
            $gameSystem._chaosIntroStep = 4;
            $gameSystem._chaosIntroActive = true;
            this.showStep(windowMessage, 4);
            return true;
        }
        if (step === 6 && linkText === '继续') {
            $gameSystem._chaosIntroStep = 7;
            $gameSystem._chaosIntroActive = false;
            return true;
        }
        return false;
    };

    ChaosGameIntro.prototype.onMessageClicked = function(windowMessage) {
        /**
         * 参数：
         * - windowMessage: Window_Message | null，典型值为当前消息窗口实例
         * 返回：boolean，true 表示已处理该点击
         * 操作：处理“再次点击对话框变为…”这种非选项点击，根据当前步骤切换到下一屏。
         */
        if (!$gameSystem || !this.isActive()) return false;
        var step = this.currentStep();
        if (step === 1) {
            $gameSystem._chaosIntroStep = 2;
            this.showStep(windowMessage, 2);
            return true;
        }
        if (step === 4) {
            $gameSystem._chaosIntroStep = 5;
            this.showStep(windowMessage, 5);
            return true;
        }
        if (step === 5) {
            $gameSystem._chaosIntroStep = 6;
            this.showStep(windowMessage, 6);
            return true;
        }
        return false;
    };

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：为新档初始化开场标记；确保开场对白只在新游戏第一次进入地图时触发。
         */
        _Game_System_initialize.call(this);
        this._chaosIntroPlayed = false;
        this._chaosIntroActive = false;
        this._chaosIntroStep = -1;
        this._chaosMainAreaOverlayMode = CHAOS_INTRO_CONFIG.enableBlackMainArea ? 'black' : 'hidden';
        this._chaosSingleActorOnly = CHAOS_INTRO_CONFIG.singleActorOnly;
    };

    function chaosEnsureControllers(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值为当前地图场景 this
         * 返回：void
         * 操作：为地图场景挂载控制器实例（遮罩与开场控制），避免散落的全局状态。
         */
        if (!sceneMap._chaosMainAreaOverlay) sceneMap._chaosMainAreaOverlay = new ChaosMainAreaOverlay(sceneMap);
        if (!sceneMap._chaosIntroController) sceneMap._chaosIntroController = new ChaosGameIntro();
    }

    function chaosGetIntroController(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值为当前地图场景 this
         * 返回：ChaosGameIntro | null
         * 操作：从地图场景上读取开场控制器实例；若不存在返回 null。
         */
        if (!sceneMap) return null;
        return sceneMap._chaosIntroController || null;
    }

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：地图场景开始时：应用黑屏遮罩，并在条件满足时触发一次开场对白。
         */
        _Scene_Map_start.call(this);

        chaosEnsureControllers(this);

        if ($gameSystem && $gameSystem._chaosSingleActorOnly) {
            /**
             * 参数：无
             * 返回：void
             * 操作：隐藏队伍跟随者（followers），让地图上只显示主角一个角色。
             */
            if ($gamePlayer && $gamePlayer.followers) {
                var followers = $gamePlayer.followers();
                if (followers && followers.hide && followers.refresh) {
                    followers.hide();
                    followers.refresh();
                }
            }
        }

        var mode = $gameSystem ? $gameSystem._chaosMainAreaOverlayMode : 'hidden';
        if (this._chaosMainAreaOverlay && this._chaosMainAreaOverlay.setMode) this._chaosMainAreaOverlay.setMode(mode);

        if (this._chaosIntroController.shouldPlay()) {
            this._chaosIntroController.play(this._messageWindow || null);
            $gameSystem._chaosIntroPlayed = true;
        }
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：每帧确保遮罩尺寸/位置适配当前分辨率（例如分辨率切换后）。
         */
        _Scene_Map_update.call(this);
        if (!this._chaosMainAreaOverlay) return;
        var mode = $gameSystem ? $gameSystem._chaosMainAreaOverlayMode : 'hidden';
        if (this._chaosMainAreaOverlay.setMode) this._chaosMainAreaOverlay.setMode(mode);
        if (this._chaosMainAreaOverlay.update) this._chaosMainAreaOverlay.update();
    };

    function chaosIsInBracketLink(textState) {
        /**
         * 参数：
         * - textState: object，典型值为 Window_Message 绘制时的文本状态
         * 返回：boolean，典型值 true/false
         * 操作：判断当前是否处于【】链接绘制状态（用于着色与点击区域收集）。
         */
        return !!(textState && textState._chaosLinkActive);
    }

    function chaosEnsureLinkState(textState) {
        /**
         * 参数：
         * - textState: object，典型值为 Window_Message 绘制时的文本状态
         * 返回：void
         * 操作：初始化文本状态上的链接字段，避免 undefined 访问。
         */
        if (!textState._chaosLinkActive) textState._chaosLinkActive = false;
        if (typeof textState._chaosLinkText !== 'string') textState._chaosLinkText = '';
        if (typeof textState._chaosLinkMinX !== 'number') textState._chaosLinkMinX = 0;
        if (typeof textState._chaosLinkMaxX !== 'number') textState._chaosLinkMaxX = 0;
        if (typeof textState._chaosLinkY !== 'number') textState._chaosLinkY = 0;
        if (typeof textState._chaosEmphasisActive !== 'boolean') textState._chaosEmphasisActive = false;
    }

    Window_Message.prototype.chaosClearLinks = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：清空当前消息窗口的可点击链接区域缓存。
         */
        this._chaosLinks = [];
    };

    Window_Message.prototype.chaosAddLinkRect = function(linkText, x, y, w, h) {
        /**
         * 参数：
         * - linkText:string 典型值为【】内文本（不含括号）
         * - x:number 典型值为窗口本地坐标
         * - y:number 典型值为窗口本地坐标
         * - w:number 典型值为链接文本宽度（像素）
         * - h:number 典型值为行高（像素）
         * 返回：void
         * 操作：记录一个可点击链接区域，用于后续命中测试。
         */
        if (!this._chaosLinks) this._chaosLinks = [];
        this._chaosLinks.push({ text: linkText, x: x, y: y, w: w, h: h });
    };

    Window_Message.prototype.chaosHitTestLink = function(localX, localY) {
        /**
         * 参数：
         * - localX:number 典型值为 canvasToLocalX(TouchInput.x)
         * - localY:number 典型值为 canvasToLocalY(TouchInput.y)
         * 返回：string|null，命中返回 linkText（不含括号），否则返回 null
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
         * 操作：根据当前窗口内容区域高度估算可见行数，用于“内容太多自动顶掉旧文字”。
         */
        var lh = this.lineHeight();
        if (lh <= 0) return 4;
        return Math.max(1, Math.floor(this.contentsHeight() / lh));
    };

    Window_Message.prototype.chaosReplaceMessageLines = function(lines) {
        /**
         * 参数：
         * - lines:Array<string>，典型值为若干行文本
         * 返回：void
         * 操作：立即用新内容替换当前消息窗口文本；若行数过多则截取最后若干行以模拟“顶掉旧文字”。
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
         * - textState: object，典型值为文本状态
         * 返回：void
         * 操作：开始新页时清空链接区域缓存，避免旧页链接残留。
         */
        this.chaosClearLinks();
        _Window_Message_newPage.call(this, textState);
    };

    var _Window_Message_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
    Window_Message.prototype.processNormalCharacter = function(textState) {
        /**
         * 参数：
         * - textState: object，典型值为文本状态（包含 text/index/x/y 等）
         * 返回：void
         * 操作：
         * - 在【】内的文字使用蓝色+下划线绘制，并记录可点击区域（支持鼠标/触控点击互动）
         * - 在{}内的文字使用暖黄色显示，仅表示强调（无互动）
         */
        chaosEnsureLinkState(textState);
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

        if (chaosIsInBracketLink(textState)) {
            this.changeTextColor(CHAOS_INTRO_CONFIG.interactiveColor);
            if (c !== '【' && c !== '】') textState._chaosLinkText += c;
        } else if (textState._chaosEmphasisActive) {
            this.changeTextColor(CHAOS_INTRO_CONFIG.emphasisColor);
        } else {
            this.resetTextColor();
        }

        _Window_Message_processNormalCharacter.call(this, textState);

        if (chaosIsInBracketLink(textState)) {
            if (c !== '】') textState._chaosLinkMaxX = Math.max(textState._chaosLinkMaxX, x1 + w);
        }

        if (c === '】' && chaosIsInBracketLink(textState)) {
            var linkText = textState._chaosLinkText;
            if (linkText && linkText.length > 0) {
                var endX = x1;
                var minX = textState._chaosLinkMinX;
                var maxX = Math.max(minX, endX);
                var linkW = maxX - minX;
                this.chaosAddLinkRect(linkText, minX, textState._chaosLinkY, linkW, h);
                var ux = minX - padding;
                var uy = (textState._chaosLinkY - padding) + h - CHAOS_INTRO_CONFIG.underlineOffsetY;
                this.contents.fillRect(ux, uy, linkW, CHAOS_INTRO_CONFIG.underlineHeight, CHAOS_INTRO_CONFIG.interactiveColor);
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
         * 返回：boolean，true 表示本帧已处理输入
         * 操作：在默认输入处理之前，优先处理【】链接点击与“再次点击对话框切换内容”的开场逻辑。
         */
        if (this.pause && !this.isAnySubWindowActive()) {
            var touch = TouchInput.isTriggered();
            var keyOk = Input.isTriggered('ok');
            var keyCancel = Input.isTriggered('cancel');
            if (touch || keyOk || keyCancel) {
                var x = this.canvasToLocalX(TouchInput.x);
                var y = this.canvasToLocalY(TouchInput.y);
                var intro = SceneManager && SceneManager._scene ? chaosGetIntroController(SceneManager._scene) : null;
                if (intro && intro.isActive()) {
                    var step = intro.currentStep();
                    var link = touch ? this.chaosHitTestLink(x, y) : null;
                    if (!link && (keyOk || keyCancel) && this._chaosLinks && this._chaosLinks.length > 0) {
                        link = this._chaosLinks[0].text;
                    }
                    if (link) {
                        if (intro.onLinkClicked(this, link)) return true;
                        return true;
                    }
                    if (intro.onMessageClicked(this)) return true;
                    if (step === 0 || step === 2 || step === 3 || step === 6) return true;
                }
            }
        }
        return _Window_Message_updateInput.call(this);
    };
})();
