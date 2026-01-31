(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：RPG Maker MV 插件入口：在地图场景（Scene_Map）创建左侧常驻HUD，并重排消息/选择窗口布局。
     */
    'use strict';

    var CHAOS_GAME_UI = {
        sidebarWidth: 360,
        sidebarPadding: 18,
        messageHeightRate: 0.25,
        hudUpdateIntervalFrames: 20,
        author: 'Terrigal'
    };

    function chaosHideWindowFrame(win) {
        /**
         * 参数：
         * - win: Window_Base | Window_Command | any，典型值为窗口实例
         * 返回：void
         * 操作：隐藏窗口外框，保留背景与内容，用于扁平化UI。
         */
        if (win && win._windowFrameSprite) win._windowFrameSprite.visible = false;
    }

    function chaosRightPaneX() {
        /**
         * 参数：无
         * 返回：number，典型值 CHAOS_GAME_UI.sidebarWidth（如 360）
         * 操作：计算右侧主区域起始x（用于地图/消息窗口对齐）。
         */
        return CHAOS_GAME_UI.sidebarWidth;
    }

    function chaosRightPaneWidth() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.boxWidth - sidebarWidth（如 1240）
         * 操作：计算右侧主区域宽度。
         */
        return Graphics.boxWidth - CHAOS_GAME_UI.sidebarWidth;
    }

    function chaosMessageHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 floor(Graphics.boxHeight * 0.25)（如 225）
         * 操作：计算底部对话框区域高度。
         */
        return Math.floor(Graphics.boxHeight * CHAOS_GAME_UI.messageHeightRate);
    }

    function chaosMessageY() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.boxHeight - messageHeight（如 675）
         * 操作：计算底部对话框区域y坐标。
         */
        return Graphics.boxHeight - chaosMessageHeight();
    }

    function chaosRightPaneTopHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.boxHeight - messageHeight（如 675）
         * 操作：计算右上方“地图可视区”的高度（消息窗口之外的区域）。
         */
        return Graphics.boxHeight - chaosMessageHeight();
    }

    function chaosApplyMapViewport(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值为当前地图场景实例 this
         * 返回：void
         * 操作：将地图渲染区域裁切到右上区域，并把“镜头中心”偏移到右侧主区域中心。
         */
        if (!sceneMap || !sceneMap._spriteset) return;

        var mask = sceneMap._chaosMapMask;
        if (!mask) {
            mask = new PIXI.Graphics();
            sceneMap._chaosMapMask = mask;
            sceneMap.addChild(mask);
        }

        mask.clear();
        mask.beginFill(0xffffff, 1.0);
        mask.drawRect(chaosRightPaneX(), 0, chaosRightPaneWidth(), chaosRightPaneTopHeight());
        mask.endFill();
        mask.visible = false;
        mask.renderable = false;

        sceneMap._spriteset.mask = mask;
        sceneMap._spriteset.x = Math.floor(CHAOS_GAME_UI.sidebarWidth / 2);
        sceneMap._spriteset.y = 0;
    }

    function Window_ChaosHUD() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：左侧HUD窗口构造器（标题、作者、角色姓名、体力/内力、基础属性）。
         */
        this.initialize.apply(this, arguments);
    }

    Window_ChaosHUD.prototype = Object.create(Window_Base.prototype);
    Window_ChaosHUD.prototype.constructor = Window_ChaosHUD;

    Window_ChaosHUD.prototype.initialize = function(x, y, width, height) {
        /**
         * 参数：
         * - x:number 典型值 0
         * - y:number 典型值 0
         * - width:number 典型值 360
         * - height:number 典型值 Graphics.boxHeight（如 900）
         * 返回：void
         * 操作：初始化HUD窗口，设置背景/隐藏边框并立即绘制一次。
         */
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.setBackgroundType(1);
        chaosHideWindowFrame(this);
        this._lineColor = 'rgba(255,255,255,0.2)';
        this._frameCount = 0;
        this._lastKey = '';
        this.refresh();
    };

    Window_ChaosHUD.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 18
         * 操作：HUD窗口内边距。
         */
        return CHAOS_GAME_UI.sidebarPadding;
    };

    Window_ChaosHUD.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：按固定帧间隔检查核心数据变化，必要时刷新HUD显示。
         */
        Window_Base.prototype.update.call(this);
        this._frameCount++;
        if (this._frameCount % CHAOS_GAME_UI.hudUpdateIntervalFrames !== 0) return;
        var key = this.buildDataKey();
        if (key !== this._lastKey) {
            this._lastKey = key;
            this.refresh();
        }
    };

    Window_ChaosHUD.prototype.buildDataKey = function() {
        /**
         * 参数：无
         * 返回：string，典型值为拼接的“角色名|hp/mp|核心属性”摘要
         * 操作：生成用于判断HUD是否需要刷新的轻量签名。
         */
        var actor = $gameParty && $gameParty.leader ? $gameParty.leader() : null;
        if (!actor) return 'none';
        return [
            actor.name(),
            actor.hp, actor.mhp,
            actor.mp, actor.mmp,
            actor.atk, actor.def, actor.mat, actor.mdf, actor.agi, actor.luk,
            actor.hit, actor.eva, actor.cnt
        ].join('|');
    };

    Window_ChaosHUD.prototype.refresh = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：重绘HUD内容（标题、作者、角色、体力/内力条、命中/防御/闪避/格挡等）。
         */
        this.contents.clear();
        var x = 0;
        var y = 0;
        var w = this.contentsWidth();

        var gameTitle = ($dataSystem && $dataSystem.gameTitle) ? $dataSystem.gameTitle : '';
        var actor = $gameParty && $gameParty.leader ? $gameParty.leader() : null;

        this.contents.fontSize = 26;
        this.changeTextColor('#ffffff');
        this.drawText(gameTitle, x, y, w, 'left');
        y += this.lineHeight();

        this.contents.fontSize = 18;
        this.changeTextColor('#cccccc');
        this.drawText('作者：' + CHAOS_GAME_UI.author, x, y, w, 'left');
        y += this.lineHeight();

        y += 8;
        this.drawHLine(y);
        y += 14;

        this.contents.fontSize = 20;
        this.changeTextColor('#cccccc');
        this.drawText('角色姓名：' + (actor ? actor.name() : '???'), x, y, w, 'left');
        y += this.lineHeight() + 10;

        var hpRate = actor ? (actor.mhp > 0 ? actor.hp / actor.mhp : 0) : 0;
        var mpRate = actor ? (actor.mmp > 0 ? actor.mp / actor.mmp : 0) : 0;

        this.drawGauge(x, y + 10, w, hpRate, '#ffffff', '#66ccff');
        this.changeTextColor('#ffffff');
        this.contents.fontSize = 20;
        this.drawText('体力', x, y, 72, 'left');
        y += this.lineHeight() + 8;

        this.drawGauge(x, y + 10, w, mpRate, '#ffffff', '#99ff99');
        this.changeTextColor('#ffffff');
        this.drawText('内力', x, y, 72, 'left');
        y += this.lineHeight() + 12;

        this.drawHLine(y);
        y += 14;

        var hitText = actor ? Math.round(actor.hit * 100) + '%' : '0%';
        var evaText = actor ? Math.round(actor.eva * 100) + '%' : '0%';
        var defText = actor ? String(actor.def) : '0';
        var blockText = actor ? Math.round(actor.cnt * 100) + '%' : '0%';

        this.contents.fontSize = 20;
        var half = Math.floor(w / 2);

        this.changeTextColor('#cccccc');
        this.drawText('命中：', x, y, 72, 'left');
        this.changeTextColor('#ffffff');
        this.drawText(hitText, x + 72, y, half - 72, 'left');
        this.changeTextColor('#cccccc');
        this.drawText('防御：', x + half, y, 72, 'left');
        this.changeTextColor('#ffffff');
        this.drawText(defText, x + half + 72, y, w - half - 72, 'left');
        y += this.lineHeight();

        this.changeTextColor('#cccccc');
        this.drawText('闪避：', x, y, 72, 'left');
        this.changeTextColor('#ffffff');
        this.drawText(evaText, x + 72, y, half - 72, 'left');
        this.changeTextColor('#cccccc');
        this.drawText('格挡：', x + half, y, 72, 'left');
        this.changeTextColor('#ffffff');
        this.drawText(blockText, x + half + 72, y, w - half - 72, 'left');
        y += this.lineHeight();
    };

    Window_ChaosHUD.prototype.drawHLine = function(y) {
        /**
         * 参数：
         * - y:number 典型值为当前绘制光标y
         * 返回：void
         * 操作：绘制HUD分割线。
         */
        this.contents.fillRect(0, y, this.contentsWidth(), 2, this._lineColor);
    };

    function chaosApplyMessageLayout(win) {
        /**
         * 参数：
         * - win: Window_Base | Window_Message | Window_ChoiceList 等，典型值为消息相关窗口
         * 返回：void
         * 操作：将窗口限制在右侧区域，避免被左侧HUD遮挡。
         */
        if (!win || !win.move) return;
        var x = chaosRightPaneX();
        var w = chaosRightPaneWidth();
        var h = chaosMessageHeight();
        var y = chaosMessageY();
        win.move(x, y, w, h);
        if (win.createContents) win.createContents();
    }

    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：在地图场景创建所有窗口后，追加创建左侧HUD，并重新布局消息相关窗口。
         */
        _Scene_Map_createAllWindows.call(this);

        this._chaosHudWindow = new Window_ChaosHUD(0, 0, CHAOS_GAME_UI.sidebarWidth, Graphics.boxHeight);
        this.addWindow(this._chaosHudWindow);

        if (this._mapNameWindow) {
            this._mapNameWindow.x = chaosRightPaneX();
        }

        if (this._messageWindow) {
            chaosApplyMessageLayout(this._messageWindow);
        }

        chaosApplyMapViewport(this);
    };

    var _Scene_Map_createSpriteset = Scene_Map.prototype.createSpriteset;
    Scene_Map.prototype.createSpriteset = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：创建地图精灵集合后，应用裁切与偏移，让地图只显示在右上区域。
         */
        _Scene_Map_createSpriteset.call(this);
        chaosApplyMapViewport(this);
    };

    var _Scene_Map_createMessageWindow = Scene_Map.prototype.createMessageWindow;
    Scene_Map.prototype.createMessageWindow = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：创建消息窗口后将其放置到右下角区域，并同步子窗口布局。
         */
        _Scene_Map_createMessageWindow.call(this);
        if (this._messageWindow) chaosApplyMessageLayout(this._messageWindow);
    };

    var _Window_Message_updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：强制消息窗口位于右下角区域（即使游戏过程中触发了重新定位逻辑）。
         */
        _Window_Message_updatePlacement.call(this);
        chaosApplyMessageLayout(this);
    };

    var _Window_ChoiceList_updatePlacement = Window_ChoiceList.prototype.updatePlacement;
    Window_ChoiceList.prototype.updatePlacement = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：让选择列表优先贴合消息窗口右侧区域，避免覆盖左侧HUD。
         */
        _Window_ChoiceList_updatePlacement.call(this);
        var messageWindow = this._messageWindow;
        if (!messageWindow) return;

        var minX = chaosRightPaneX();
        if (this.x < minX) this.x = minX;

        var maxY = chaosMessageY();
        if (this.y < maxY) this.y = maxY;

        var maxX = chaosRightPaneX() + chaosRightPaneWidth() - this.width;
        if (this.x > maxX) this.x = maxX;
    };

    var _Window_NumberInput_updatePlacement = Window_NumberInput.prototype.updatePlacement;
    Window_NumberInput.prototype.updatePlacement = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：让数值输入窗口跟随消息窗口区域，避免遮挡左侧HUD。
         */
        _Window_NumberInput_updatePlacement.call(this);
        var minX = chaosRightPaneX();
        if (this.x < minX) this.x = minX;
        var maxY = chaosMessageY();
        if (this.y < maxY) this.y = maxY;
    };

    var _Window_EventItem_updatePlacement = Window_EventItem.prototype.updatePlacement;
    Window_EventItem.prototype.updatePlacement = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：让事件物品选择窗口位于右下角区域，避免遮挡左侧HUD。
         */
        _Window_EventItem_updatePlacement.call(this);
        var minX = chaosRightPaneX();
        if (this.x < minX) this.x = minX;
        var maxY = chaosMessageY();
        if (this.y < maxY) this.y = maxY;
    };

    var _Window_ScrollText_updatePlacement = Window_ScrollText.prototype.updatePlacement;
    Window_ScrollText.prototype.updatePlacement = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：让滚动文本窗口也在右侧区域显示，避免覆盖左侧HUD。
         */
        _Window_ScrollText_updatePlacement.call(this);
        var minX = chaosRightPaneX();
        if (this.x < minX) this.x = minX;
        var maxY = chaosMessageY();
        if (this.y < maxY) this.y = maxY;
        var maxW = chaosRightPaneWidth();
        if (this.width !== maxW) {
            this.width = maxW;
            this.createContents();
        }
        this.y = 0;
        this.height = chaosRightPaneTopHeight();
        this.createContents();
    };
})();
