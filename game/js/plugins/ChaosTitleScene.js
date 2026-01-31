(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：RPG Maker MV 插件入口，定义自定义标题场景与相关窗口类/方法。
     */
    'use strict';

    var CHAOS_TITLE_UI = {
        sidebarWidth: 360,
        reservedBottom: 170,
        title: function() {
            /**
             * 参数：无
             * 返回：string，典型值为 $dataSystem.gameTitle（如“乱·江湖之穷徒末路”）
             * 操作：安全读取游戏标题；当数据尚未加载时返回空字符串。
             */
            return ($dataSystem && $dataSystem.gameTitle) ? $dataSystem.gameTitle : '';
        },
        version: '1.0发布版',
        author: 'Terrigal',
        characterName: '???',
        gauges: [
            { label: '体力', rate: 0.0, c1: '#ffffff', c2: '#66ccff' },
            { label: '内力', rate: 0.0, c1: '#ffffff', c2: '#99ff99' }
        ],
        stats: [
            { left: '命中', leftValue: '0', right: '防御', rightValue: '0' },
            { left: '闪避', leftValue: '0', right: '格挡值', rightValue: '0' }
        ],
        mainText: {
            header: '欢迎来到互动小说《%1》',
            paragraphs: [
                '本作为《%1》的前传，借助某位角色的视角，讲述了在玩家到达安福县之前，麒麟山上发生的故事。',
                '本游戏基于国产原创桌面角色扮演游戏《侠界之旅》（CC BY-NC-SA 4.0协议）创作。因本人技术有限，战斗部分进行了简化。',
                '若想更多体验《侠界之旅》TRPG的魅力，欢迎前往QQ群交流。',
                '《侠界之旅交流群》一群：210679492  二群：753714737'
            ],
            warning: '注意：在TRPG中，一般是由一名主持人根据玩家的行为，结合剧本设定/即兴创作故事走向。而在本游戏中将由系统扮演主持人并给予预设选项。',
            legal: '未经作者的书面同意，任何人不得复制、修改、打印或翻印本游戏的任何内容，不得用于商业行为，违者将追究相关法律责任。'
        }
    };

    function chaosHideWindowFrame(win) {
        /**
         * 参数：
         * - win: Window_Base | Window_Command | any，典型值为本插件创建的窗口实例
         * 返回：void
         * 操作：隐藏窗口的外框（仅保留背景/内容），用于实现更扁平的UI风格。
         */
        if (win && win._windowFrameSprite) win._windowFrameSprite.visible = false;
    }

    var _Window_Base_standardFontFace = Window_Base.prototype.standardFontFace;
    Window_Base.prototype.standardFontFace = function() {
        /**
         * 参数：无
         * 返回：string，字体族名称（font-family）
         * 操作：中文环境优先使用更清晰的免费黑体风格字体链；非中文环境回落到原实现。
         */
        if ($gameSystem && $gameSystem.isChinese && $gameSystem.isChinese()) {
            return 'Noto Sans SC, Source Han Sans SC, Microsoft YaHei UI, Microsoft YaHei, PingFang SC, SimHei, sans-serif';
        }
        return _Window_Base_standardFontFace.call(this);
    };

    function Window_ChaosSidebar() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：侧栏窗口构造器（RPG Maker MV 的窗口类惯用写法）。
         */
        this.initialize.apply(this, arguments);
    }

    Window_ChaosSidebar.prototype = Object.create(Window_Base.prototype);
    Window_ChaosSidebar.prototype.constructor = Window_ChaosSidebar;

    Window_ChaosSidebar.prototype.initialize = function(x, y, width, height) {
        /**
         * 参数：
         * - x:number 典型值 0
         * - y:number 典型值 0
         * - width:number 典型值 360（sidebarWidth）
         * - height:number 典型值 Graphics.boxHeight（如 900）
         * 返回：void
         * 操作：初始化侧栏窗口，设置背景/隐藏边框并首次绘制内容。
         */
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.setBackgroundType(1);
        chaosHideWindowFrame(this);
        this._lineColor = 'rgba(255,255,255,0.2)';
        this.refresh();
    };

    Window_ChaosSidebar.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 18
         * 操作：定义侧栏窗口内边距。
         */
        return 18;
    };

    Window_ChaosSidebar.prototype.refresh = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：重绘侧栏内容（标题、版本、作者、角色占位、属性条、数值）。
         */
        this.contents.clear();
        var x = 0;
        var y = 0;
        var w = this.contentsWidth();

        this.contents.fontSize = 28;
        this.changeTextColor('#ffffff');
        this.drawText(CHAOS_TITLE_UI.title(), x, y, w, 'left');
        y += this.lineHeight();

        this.contents.fontSize = 20;
        this.changeTextColor('#dddddd');
        this.drawText(CHAOS_TITLE_UI.version, x, y, w, 'left');
        y += this.lineHeight();

        y += 6;
        this.drawHLine(y);
        y += 10;

        this.contents.fontSize = 20;
        this.changeTextColor('#cccccc');
        this.drawText('作者：' + CHAOS_TITLE_UI.author, x, y, w, 'left');
        y += this.lineHeight();

        y += 14;
        this.drawHLine(y);
        y += 14;

        this.contents.fontSize = 20;
        this.changeTextColor('#cccccc');
        this.drawText('角色姓名：' + CHAOS_TITLE_UI.characterName, x, y, w, 'left');
        y += this.lineHeight() + 6;

        for (var i = 0; i < CHAOS_TITLE_UI.gauges.length; i++) {
            var g = CHAOS_TITLE_UI.gauges[i];
            this.drawGauge(x, y + 10, w, g.rate, g.c1, g.c2);
            this.changeTextColor('#ffffff');
            this.drawText(g.label, x, y, 72, 'left');
            y += this.lineHeight() + 6;
        }

        y += 10;
        this.drawHLine(y);
        y += 12;

        this.contents.fontSize = 20;
        for (var s = 0; s < CHAOS_TITLE_UI.stats.length; s++) {
            var row = CHAOS_TITLE_UI.stats[s];
            var half = Math.floor(w / 2);
            this.changeTextColor('#cccccc');
            this.drawText(row.left + '：', x, y, 72, 'left');
            this.changeTextColor('#ffffff');
            this.drawText(row.leftValue, x + 72, y, half - 72, 'left');
            this.changeTextColor('#cccccc');
            this.drawText(row.right + '：', x + half, y, 84, 'left');
            this.changeTextColor('#ffffff');
            this.drawText(row.rightValue, x + half + 84, y, w - half - 84, 'left');
            y += this.lineHeight();
        }
    };

    Window_ChaosSidebar.prototype.drawHLine = function(y) {
        /**
         * 参数：
         * - y:number 典型值为当前绘制光标y（如 60/120 等）
         * 返回：void
         * 操作：在侧栏内容区绘制一条横线分隔。
         */
        this.contents.fillRect(0, y, this.contentsWidth(), 2, this._lineColor);
    };

    function Window_ChaosSideCommands() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：左下角命令窗口构造器（SAVES/RESTART）。
         */
        this.initialize.apply(this, arguments);
    }

    Window_ChaosSideCommands.prototype = Object.create(Window_Command.prototype);
    Window_ChaosSideCommands.prototype.constructor = Window_ChaosSideCommands;

    Window_ChaosSideCommands.prototype.initialize = function(x, y, width) {
        /**
         * 参数：
         * - x:number 典型值 12
         * - y:number 典型值 0（后续根据窗口高度定位到底部）
         * - width:number 典型值 sidebarWidth - 24
         * 返回：void
         * 操作：初始化命令窗口，设置透明背景并隐藏边框。
         */
        this._windowWidth = width;
        Window_Command.prototype.initialize.call(this, x, y);
        this.setBackgroundType(2);
        chaosHideWindowFrame(this);
    };

    Window_ChaosSideCommands.prototype.windowWidth = function() {
        /**
         * 参数：无
         * 返回：number，窗口宽度（像素）
         * 操作：固定该命令窗口宽度，避免受默认实现影响。
         */
        return this._windowWidth;
    };

    Window_ChaosSideCommands.prototype.numVisibleRows = function() {
        /**
         * 参数：无
         * 返回：number，典型值 2
         * 操作：声明命令窗口可见行数（用于计算窗口高度）。
         */
        return 2;
    };

    Window_ChaosSideCommands.prototype.makeCommandList = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：构建命令列表（读档/重开）；读档按钮在无存档时自动禁用。
         */
        this.addCommand('SAVES', 'saves', DataManager.isAnySavefileExists());
        this.addCommand('RESTART', 'restart', true);
    };

    Window_ChaosSideCommands.prototype.drawItem = function(index) {
        /**
         * 参数：
         * - index:number 典型值 0 或 1
         * 返回：void
         * 操作：绘制单个命令项的文本，并根据可用性设置透明度。
         */
        var rect = this.itemRectForText(index);
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.contents.fontSize = 20;
        this.drawText(this.commandName(index), rect.x, rect.y, rect.width, 'left');
    };

    Window_ChaosSideCommands.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 10
         * 操作：设置命令窗口内边距，缩小按钮区域更贴近截图风格。
         */
        return 10;
    };

    function Window_ChaosMain() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：右侧正文窗口构造器（说明/告示文本）。
         */
        this.initialize.apply(this, arguments);
    }

    Window_ChaosMain.prototype = Object.create(Window_Base.prototype);
    Window_ChaosMain.prototype.constructor = Window_ChaosMain;

    Window_ChaosMain.prototype.initialize = function(x, y, width, height) {
        /**
         * 参数：
         * - x:number 典型值 sidebarWidth（如 360）
         * - y:number 典型值 0
         * - width:number 典型值 Graphics.boxWidth - sidebarWidth（如 1240）
         * - height:number 典型值 Graphics.boxHeight - reservedBottom
         * 返回：void
         * 操作：初始化正文窗口，设置透明背景/隐藏边框并绘制文本。
         */
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.setBackgroundType(2);
        chaosHideWindowFrame(this);
        this.refresh();
    };

    Window_ChaosMain.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 36
         * 操作：正文窗口的内边距，保证长文段落阅读舒适。
         */
        return 36;
    };

    Window_ChaosMain.prototype.refresh = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：重绘正文区域（标题欢迎语、段落、提示、声明）。
         */
        this.contents.clear();
        var x = 0;
        var y = 0;
        var w = this.contentsWidth();
        var title = CHAOS_TITLE_UI.title();
        var mt = CHAOS_TITLE_UI.mainText;

        this.contents.fontSize = 24;
        this.changeTextColor('#ffffff');
        y = this.drawWrappedText(mt.header.replace('%1', title), x, y, w, this.lineHeight() + 4);

        y += 10;
        this.contents.fontSize = 20;
        this.changeTextColor('#dddddd');
        for (var i = 0; i < mt.paragraphs.length; i++) {
            y = this.drawWrappedText(mt.paragraphs[i].replace('%1', title), x, y, w, this.lineHeight() + 2);
            y += 10;
        }

        y += 8;
        this.changeTextColor('#ffcc66');
        this.contents.fontSize = 20;
        y = this.drawWrappedText('▲ ' + mt.warning, x, y, w, this.lineHeight() + 2);

        y += 12;
        this.changeTextColor('#ff6699');
        this.contents.fontSize = 20;
        y = this.drawWrappedText(mt.legal, x, y, w, this.lineHeight() + 2);
    };

    Window_ChaosMain.prototype.drawWrappedText = function(text, x, y, width, stepY) {
        /**
         * 参数：
         * - text:string 典型值为一段中文说明
         * - x:number 典型值 0
         * - y:number 典型值 0 或当前绘制y
         * - width:number 典型值 this.contentsWidth()
         * - stepY:number 典型值 this.lineHeight()+2
         * 返回：number，绘制结束后的 y 值
         * 操作：按宽度自动换行绘制文本，并返回新的y坐标便于继续绘制。
         */
        var lines = this.wrapText(text, width);
        for (var i = 0; i < lines.length; i++) {
            this.drawText(lines[i], x, y, width, 'left');
            y += stepY;
        }
        return y;
    };

    Window_ChaosMain.prototype.wrapText = function(text, width) {
        /**
         * 参数：
         * - text:string 典型值为中文长句/段落
         * - width:number 典型值 this.contentsWidth()
         * 返回：Array<string>，按像素宽度切分后的行数组
         * 操作：按当前字体的 textWidth 进行逐字换行，生成可直接 drawText 的行列表。
         */
        var out = [];
        var current = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (ch === '\n') {
                out.push(current);
                current = '';
                continue;
            }
            var next = current + ch;
            if (this.textWidth(next) > width && current.length > 0) {
                out.push(current);
                current = ch;
            } else {
                current = next;
            }
        }
        if (current.length > 0) out.push(current);
        return out;
    };

    function Window_ChaosStart() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：右下角“开始游戏”按钮窗口构造器。
         */
        this.initialize.apply(this, arguments);
    }

    Window_ChaosStart.prototype = Object.create(Window_Command.prototype);
    Window_ChaosStart.prototype.constructor = Window_ChaosStart;

    Window_ChaosStart.prototype.initialize = function(x, y, width) {
        /**
         * 参数：
         * - x:number 典型值 mainX + 36
         * - y:number 典型值 0（后续根据窗口高度定位到底部）
         * - width:number 典型值 240
         * 返回：void
         * 操作：初始化开始按钮窗口并默认激活，允许直接回车开始游戏。
         */
        this._windowWidth = width;
        Window_Command.prototype.initialize.call(this, x, y);
        this.setBackgroundType(2);
        chaosHideWindowFrame(this);
        this.select(0);
        this.activate();
    };

    Window_ChaosStart.prototype.windowWidth = function() {
        /**
         * 参数：无
         * 返回：number，窗口宽度（像素）
         * 操作：固定开始按钮窗口宽度。
         */
        return this._windowWidth;
    };

    Window_ChaosStart.prototype.numVisibleRows = function() {
        /**
         * 参数：无
         * 返回：number，典型值 1
         * 操作：声明开始按钮窗口可见行数（用于计算高度）。
         */
        return 1;
    };

    Window_ChaosStart.prototype.makeCommandList = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：构建开始按钮的命令列表（单一入口）。
         */
        this.addCommand('【开始游戏】', 'start', true);
    };

    Window_ChaosStart.prototype.drawItem = function(index) {
        /**
         * 参数：
         * - index:number 典型值 0
         * 返回：void
         * 操作：绘制“开始游戏”文本，使用更醒目的颜色。
         */
        var rect = this.itemRectForText(index);
        this.changeTextColor('#66aaff');
        this.contents.fontSize = 24;
        this.drawText(this.commandName(index), rect.x, rect.y, rect.width, 'left');
    };

    Window_ChaosStart.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 0
         * 操作：开始按钮窗口不留内边距，使点击区域更贴近文本。
         */
        return 0;
    };

    var _Scene_Title_createForeground = Scene_Title.prototype.createForeground;
    Scene_Title.prototype.createForeground = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：保留原前景创建逻辑，同时隐藏默认标题精灵，避免与自定义UI重复。
         */
        _Scene_Title_createForeground.call(this);
        if (this._gameTitleSprite) this._gameTitleSprite.visible = false;
    };

    Scene_Title.prototype.playTitleMusic = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：禁用标题BGM（进入标题场景时停止所有音频），为后续设置面板留出控制空间。
         */
        if (AudioManager && AudioManager.stopAll) AudioManager.stopAll();
    };

    Scene_Title.prototype.createCommandWindow = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：用自定义窗口替换默认标题命令窗口，搭建左右分栏布局及按钮交互。
         */
        this.createChaosBackground();

        var sidebarW = CHAOS_TITLE_UI.sidebarWidth;
        this._chaosSidebarWindow = new Window_ChaosSidebar(0, 0, sidebarW, Graphics.boxHeight);
        this.addWindow(this._chaosSidebarWindow);

        var sideCmdW = sidebarW - 24;
        var sideCmdX = 12;
        this._chaosSideCommandWindow = new Window_ChaosSideCommands(sideCmdX, 0, sideCmdW);
        this._chaosSideCommandWindow.y = Graphics.boxHeight - this._chaosSideCommandWindow.height - 22;
        this._chaosSideCommandWindow.setHandler('saves', this.commandChaosSaves.bind(this));
        this._chaosSideCommandWindow.setHandler('restart', this.commandChaosRestart.bind(this));
        this.addWindow(this._chaosSideCommandWindow);

        var mainX = sidebarW;
        var mainW = Graphics.boxWidth - sidebarW;
        this._chaosMainWindow = new Window_ChaosMain(mainX, 0, mainW, Graphics.boxHeight - CHAOS_TITLE_UI.reservedBottom);
        this.addWindow(this._chaosMainWindow);

        var startW = 240;
        var startX = mainX + 36;
        this._chaosStartWindow = new Window_ChaosStart(startX, 0, startW);
        this._chaosStartWindow.y = Graphics.boxHeight - this._chaosStartWindow.height - 36;
        this._chaosStartWindow.setHandler('start', this.commandChaosRestart.bind(this));
        this.addWindow(this._chaosStartWindow);

        this._commandWindow = this._chaosStartWindow;
    };

    var _Scene_Title_update = Scene_Title.prototype.update;
    Scene_Title.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：每帧处理键盘/触控输入，在“开始游戏”和“SAVES/RESTART”之间切换焦点。
         */
        _Scene_Title_update.call(this);
        if (!this._chaosSideCommandWindow || !this._chaosStartWindow) return;

        if (Input.isTriggered('left')) {
            this._chaosStartWindow.deactivate();
            this._chaosSideCommandWindow.activate();
            if (this._chaosSideCommandWindow.index() < 0) this._chaosSideCommandWindow.select(0);
        } else if (Input.isTriggered('right')) {
            this._chaosSideCommandWindow.deactivate();
            this._chaosStartWindow.activate();
            if (this._chaosStartWindow.index() < 0) this._chaosStartWindow.select(0);
        } else if (Input.isTriggered('cancel')) {
            this._chaosSideCommandWindow.deactivate();
            this._chaosStartWindow.activate();
            if (this._chaosStartWindow.index() < 0) this._chaosStartWindow.select(0);
        }

        if (TouchInput.isTriggered()) {
            if (this._chaosSideCommandWindow.isOpenAndActive() === false && this._chaosSideCommandWindow.isTouchedInsideFrame()) {
                this._chaosStartWindow.deactivate();
                this._chaosSideCommandWindow.activate();
                if (this._chaosSideCommandWindow.index() < 0) this._chaosSideCommandWindow.select(0);
            } else if (this._chaosStartWindow.isOpenAndActive() === false && this._chaosStartWindow.isTouchedInsideFrame()) {
                this._chaosSideCommandWindow.deactivate();
                this._chaosStartWindow.activate();
                if (this._chaosStartWindow.index() < 0) this._chaosStartWindow.select(0);
            }
        }
    };

    Scene_Title.prototype.createChaosBackground = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：生成纯色背景与侧栏底色，并保证背景位于 windowLayer 之下。
         */
        if (this._chaosBgSprite) return;
        var bmp = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        bmp.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight, '#0b0b0b');
        var sidebarW = CHAOS_TITLE_UI.sidebarWidth;
        bmp.fillRect(0, 0, sidebarW, Graphics.boxHeight, '#1a1a1a');
        bmp.fillRect(sidebarW - 1, 0, 1, Graphics.boxHeight, 'rgba(255,255,255,0.15)');
        this._chaosBgSprite = new Sprite(bmp);
        var idx = 0;
        if (this._windowLayer) idx = this.getChildIndex(this._windowLayer);
        this.addChildAt(this._chaosBgSprite, idx);
    };

    Scene_Title.prototype.commandChaosSaves = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：打开读档场景；关闭并停用标题上的自定义按钮窗口以避免输入冲突。
         */
        if (this._chaosSideCommandWindow) {
            this._chaosSideCommandWindow.close();
            this._chaosSideCommandWindow.deactivate();
        }
        if (this._chaosStartWindow) {
            this._chaosStartWindow.close();
            this._chaosStartWindow.deactivate();
        }
        SceneManager.push(Scene_Load);
    };

    Scene_Title.prototype.commandChaosRestart = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：新开游戏并切换到地图场景；用于“开始游戏”和“RESTART”两处入口。
         */
        if (this._chaosSideCommandWindow) {
            this._chaosSideCommandWindow.close();
            this._chaosSideCommandWindow.deactivate();
        }
        if (this._chaosStartWindow) {
            this._chaosStartWindow.close();
            this._chaosStartWindow.deactivate();
        }
        DataManager.setupNewGame();
        this.fadeOutAll();
        SceneManager.goto(Scene_Map);
    };
})();
