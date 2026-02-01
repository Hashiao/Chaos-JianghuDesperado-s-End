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
        mapZoom: 0.75,
        hudUpdateIntervalFrames: 20,
        author: 'Terrigal',
        placeholderName: '???'
    };

    function chaosClampMapZoom(value) {
        /**
         * 参数：
         * - value: number，典型值 0.85 / 1.0 / 1.2
         * 返回：number，典型值 0.5~1.5 范围内
         * 操作：约束地图缩放倍率，避免设置过大/过小导致画面不可用。
         * 业务说明：
         * - value < 1：地图缩小（视角“更高”，一次看到更多地块）
         * - value = 1：默认视角
         * - value > 1：地图放大（视角“更低”，一次看到更少地块）
         */
        var n = Number(value);
        if (!isFinite(n)) n = 1;
        if (n < 0.5) n = 0.5;
        if (n > 1.5) n = 1.5;
        return n;
    }

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
         * 返回：number，典型值 Graphics.width - sidebarWidth（如 1240）
         * 操作：计算右侧主区域宽度。
         */
        return Graphics.width - CHAOS_GAME_UI.sidebarWidth;
    }

    function chaosMessageHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 floor(Graphics.height * 0.25)（如 225）
         * 操作：计算底部对话框区域高度。
         */
        return Math.floor(Graphics.height * CHAOS_GAME_UI.messageHeightRate);
    }

    function chaosMessageY() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.height - messageHeight（如 675）
         * 操作：计算底部对话框区域y坐标。
         */
        return Graphics.height - chaosMessageHeight();
    }

    function chaosRightPaneTopHeight() {
        /**
         * 参数：无
         * 返回：number，典型值 Graphics.height - messageHeight（如 675）
         * 操作：计算右上方“地图可视区”的高度（消息窗口之外的区域）。
         */
        return Graphics.height - chaosMessageHeight();
    }

    function chaosApplyMapViewport(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值为当前地图场景实例 this
         * 返回：void
         * 操作：将地图渲染区域裁切到右上区域；当地图像素尺寸小于可视区时自动等比放大，确保填满灰色主区域。
         */
        if (!sceneMap || !sceneMap._spriteset) return;

        var viewportX = chaosRightPaneX();
        var viewportW = chaosRightPaneWidth();
        var viewportH = chaosRightPaneTopHeight();

        var mask = sceneMap._chaosMapMask;
        if (!mask) {
            mask = new PIXI.Graphics();
            sceneMap._chaosMapMask = mask;
            sceneMap.addChild(mask);
        }

        mask.clear();
        mask.beginFill(0xffffff, 1.0);
        mask.drawRect(viewportX, 0, viewportW, viewportH);
        mask.endFill();
        mask.visible = true;
        mask.renderable = true;
        mask.alpha = 0.0;

        var spriteset = sceneMap._spriteset;
        spriteset.mask = mask;

        var baseW = Math.max(1, Graphics.width);
        var baseH = Math.max(1, Graphics.height);
        var mapPixW = ($gameMap && $gameMap.tileWidth) ? $gameMap.width() * $gameMap.tileWidth() : baseW;
        var mapPixH = ($gameMap && $gameMap.tileHeight) ? $gameMap.height() * $gameMap.tileHeight() : baseH;
        mapPixW = Math.max(1, mapPixW);
        mapPixH = Math.max(1, mapPixH);

        var zoom = chaosClampMapZoom(CHAOS_GAME_UI.mapZoom);
        var scale = 1;
        if (mapPixW < viewportW || mapPixH < viewportH) {
            /**
             * 参数：无
             * 返回：void
             * 操作：小地图默认会“放大填满主区域”以避免大片空白。\n+             * 业务说明：\n+             * - 你可以通过 mapZoom < 1 来“反向拉远镜头”，即使小地图也能看到更多地块；\n+             * - 但当 scale 被拉到 < 1 时，小地图会出现边缘空白，这是预期行为（因为视角更高了）。
             */
            var fillScale = Math.max(viewportW / mapPixW, viewportH / mapPixH);
            scale = fillScale * zoom;
        } else {
            scale = zoom;
        }
        spriteset._chaosViewportScale = scale;
        spriteset._chaosViewportX = Math.floor(viewportX + (viewportW - baseW * scale) / 2);
        spriteset._chaosViewportY = Math.floor((viewportH - baseH * scale) / 2);

        spriteset.scale.x = spriteset._chaosViewportScale;
        spriteset.scale.y = spriteset._chaosViewportScale;
        spriteset.x = spriteset._chaosViewportX;
        spriteset.y = spriteset._chaosViewportY;
    }

    function chaosIsInMainArea(canvasX, canvasY) {
        /**
         * 参数：
         * - canvasX:number 典型值 TouchInput.x
         * - canvasY:number 典型值 TouchInput.y
         * 返回：boolean
         * 操作：判断鼠标/触控坐标是否位于右上“游戏主区域”内（用于限制点击移动与坐标换算）。
         */
        var x0 = chaosRightPaneX();
        var y0 = 0;
        var w = chaosRightPaneWidth();
        var h = chaosRightPaneTopHeight();
        return canvasX >= x0 && canvasX < x0 + w && canvasY >= y0 && canvasY < y0 + h;
    }

    function chaosViewportToScreenX(gameMap, canvasX) {
        /**
         * 参数：
         * - gameMap: Game_Map，典型值为 $gameMap
         * - canvasX:number 典型值 TouchInput.x
         * 返回：number，典型值为换算后的屏幕坐标x（0..Graphics.width）
         * 操作：将右上主区域内的canvas坐标，逆变换为RMMV默认“全屏”坐标系下的x，用于点击移动。
         */
        var scene = SceneManager && SceneManager._scene ? SceneManager._scene : null;
        var spriteset = scene && scene._spriteset ? scene._spriteset : null;
        if (!spriteset) return canvasX;
        var scale = spriteset.scale ? spriteset.scale.x : 1;
        if (!scale || scale <= 0) scale = 1;
        return (canvasX - spriteset.x) / scale;
    }

    function chaosViewportToScreenY(gameMap, canvasY) {
        /**
         * 参数：
         * - gameMap: Game_Map，典型值为 $gameMap
         * - canvasY:number 典型值 TouchInput.y
         * 返回：number，典型值为换算后的屏幕坐标y（0..Graphics.height）
         * 操作：将右上主区域内的canvas坐标，逆变换为RMMV默认“全屏”坐标系下的y，用于点击移动。
         */
        var scene = SceneManager && SceneManager._scene ? SceneManager._scene : null;
        var spriteset = scene && scene._spriteset ? scene._spriteset : null;
        if (!spriteset) return canvasY;
        var scale = spriteset.scale ? spriteset.scale.y : 1;
        if (!scale || scale <= 0) scale = 1;
        return (canvasY - spriteset.y) / scale;
    }

    var _Spriteset_Base_updatePosition = Spriteset_Base.prototype.updatePosition;
    Spriteset_Map.prototype.updatePosition = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：在默认缩放/震动计算后，应用自定义“右上游戏主区域”视口的缩放与偏移，保证地图填满可视区。
         */
        _Spriteset_Base_updatePosition.call(this);
        if (typeof this._chaosViewportScale !== 'number') return;
        this.scale.x = this._chaosViewportScale;
        this.scale.y = this._chaosViewportScale;
        this.x = (this._chaosViewportX || 0) + Math.round($gameScreen.shake());
        this.y = (this._chaosViewportY || 0);
    };

    var _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：限制“点击地块移动”只在右上游戏主区域内生效，避免点击HUD/对话框时误触。
         */
        if (TouchInput.isTriggered() || this._touchCount > 0) {
            if (TouchInput.isPressed()) {
                if (!chaosIsInMainArea(TouchInput.x, TouchInput.y)) {
                    $gameTemp.clearDestination();
                    this._touchCount = 0;
                    return;
                }
            }
        }
        _Scene_Map_processMapTouch.call(this);
    };

    var _Game_Map_canvasToMapX = Game_Map.prototype.canvasToMapX;
    Game_Map.prototype.canvasToMapX = function(x) {
        /**
         * 参数：
         * - x:number 典型值 TouchInput.x
         * 返回：number，地图格子x
         * 操作：当地图渲染被缩放/偏移到右上主区域时，修正点击坐标到默认屏幕坐标系，保证点哪走哪。
         */
        var fixedX = chaosViewportToScreenX(this, x);
        return _Game_Map_canvasToMapX.call(this, fixedX);
    };

    var _Game_Map_canvasToMapY = Game_Map.prototype.canvasToMapY;
    Game_Map.prototype.canvasToMapY = function(y) {
        /**
         * 参数：
         * - y:number 典型值 TouchInput.y
         * 返回：number，地图格子y
         * 操作：当地图渲染被缩放/偏移到右上主区域时，修正点击坐标到默认屏幕坐标系，保证点哪走哪。
         */
        var fixedY = chaosViewportToScreenY(this, y);
        return _Game_Map_canvasToMapY.call(this, fixedY);
    };

    function Window_ChaosHUD() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：左侧HUD窗口构造器（标题、作者、角色姓名、体力/内力、基础属性）。
         */
        this.initialize.apply(this, arguments);
    }

    function chaosGetUidBridge() {
        /**
         * 参数：无
         * 返回：object|null，典型值 Chaos.UidBridge
         * 操作：获取 UID↔Actor 桥接器（如果未加载则返回 null）。
         */
        if (window.Chaos && window.Chaos.UidBridge) return window.Chaos.UidBridge;
        return null;
    }

    function chaosFormatNumber(value) {
        /**
         * 参数：
         * - value: number，典型值 3 / 3.25 / -1
         * 返回：string，典型值 '3' / '3.25' / '0'
         * 操作：把数值格式化为可显示文本：负数或非法数显示为 '0'；整数去掉小数点；小数保留两位。
         */
        var n = Number(value);
        if (!isFinite(n) || n < 0) return '0';
        if ((n | 0) === n) return String(n | 0);
        return n.toFixed(2);
    }

    function chaosSafeRate(cur, max) {
        /**
         * 参数：
         * - cur: number，典型值 50 / -1
         * - max: number，典型值 100 / -1
         * 返回：number，典型值 0..1
         * 操作：计算 cur/max；当任一为无效值（负数/0）时返回 0。
         */
        var c = Number(cur);
        var m = Number(max);
        if (!isFinite(c) || !isFinite(m)) return 0;
        if (c < 0 || m <= 0) return 0;
        return c / m;
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
        var uid = this.targetUid();
        var bridge = chaosGetUidBridge();
        var displayName = bridge ? bridge.getDisplayName(uid) : CHAOS_GAME_UI.placeholderName;
        var useReal = $gameSystem ? !!$gameSystem._chaosHudUseRealStats : false;

        if (useReal) {
            var actor = $gameParty && $gameParty.leader ? $gameParty.leader() : null;
            if (!actor) return 'none';
            return [
                displayName,
                actor.hp, actor.mhp,
                actor.mp, actor.mmp,
                actor.atk, actor.def, actor.mat, actor.mdf, actor.agi, actor.luk,
                actor.hit, actor.eva, actor.cnt
            ].join('|');
        }

        var stats = bridge ? bridge.getStats(uid) : null;
        if (!stats) return 'none';
        return [
            displayName,
            stats.hp, stats.maxHp,
            stats.mp, stats.maxMp,
            stats.hit, stats.def, stats.eva, stats.blk
        ].join('|');
    };

    Window_ChaosHUD.prototype.targetUid = function() {
        /**
         * 参数：无
         * 返回：string，典型值 '000000'
         * 操作：返回 HUD 当前要显示的“角色UID”。目前固定为主角UID；后续扩展队伍/切换目标时只改这里。
         */
        return '000000';
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
        var useReal = $gameSystem ? !!$gameSystem._chaosHudUseRealStats : false;
        var actor = useReal && $gameParty && $gameParty.leader ? $gameParty.leader() : null;
        var uid = this.targetUid();
        var bridge = chaosGetUidBridge();
        if (bridge && bridge.initStatsFromActorIfInvalid) {
            bridge.initStatsFromActorIfInvalid(uid);
        }
        var stats = bridge ? bridge.getStats(uid) : null;

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
        var displayName = bridge ? bridge.getDisplayName(uid) : (useReal && actor ? actor.name() : CHAOS_GAME_UI.placeholderName);
        this.drawText('角色姓名：' + displayName, x, y, w, 'left');
        y += this.lineHeight() + 10;

        var hpRate = 0;
        var mpRate = 0;
        if (useReal && actor) {
            hpRate = actor.mhp > 0 ? actor.hp / actor.mhp : 0;
            mpRate = actor.mmp > 0 ? actor.mp / actor.mmp : 0;
        } else if (stats) {
            hpRate = chaosSafeRate(stats.hp, stats.maxHp);
            mpRate = chaosSafeRate(stats.mp, stats.maxMp);
        }

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

        var hitText = '0';
        var evaText = '0';
        var defText = '0';
        var blockText = '0';
        if (useReal && actor) {
            hitText = Math.round(actor.hit * 100) + '%';
            evaText = Math.round(actor.eva * 100) + '%';
            defText = String(actor.def);
            blockText = Math.round(actor.cnt * 100) + '%';
        } else if (stats) {
            hitText = chaosFormatNumber(stats.hit);
            evaText = chaosFormatNumber(stats.eva);
            defText = chaosFormatNumber(stats.def);
            blockText = chaosFormatNumber(stats.blk);
        }

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

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：为新档初始化HUD占位显示开关；默认显示“???”与0，避免过早暴露数值。
         */
        _Game_System_initialize.call(this);
        this._chaosHudUseRealStats = false;
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

    function Window_ChaosHudCommands() {
        /**
         * 参数：无（通过 arguments 透传给 initialize）
         * 返回：void
         * 操作：左侧HUD底部“存档/读档”按钮窗口构造器。
         */
        this.initialize.apply(this, arguments);
    }
 
    Window_ChaosHudCommands.prototype = Object.create(Window_Command.prototype);
    Window_ChaosHudCommands.prototype.constructor = Window_ChaosHudCommands;
 
    function chaosIsSaveAllowedNow() {
        /**
         * 参数：无
         * 返回：boolean
         * 操作：判断当前是否允许存档（避免对话进行中/事件执行中等导致异常体验）。
         */
        if (!$gameSystem || !$gameSystem.isSaveEnabled || !$gameSystem.isSaveEnabled()) return false;
        if ($gameMessage && $gameMessage.isBusy && $gameMessage.isBusy()) return false;
        if (window.Chaos && window.Chaos.DialogueRuntime && window.Chaos.DialogueRuntime.isActive && window.Chaos.DialogueRuntime.isActive()) return false;
        return true;
    }
 
    Window_ChaosHudCommands.prototype.initialize = function(x, y, width) {
        /**
         * 参数：
         * - x:number 典型值 12
         * - y:number 典型值 0（后续根据窗口高度定位到底部）
         * - width:number 典型值 sidebarWidth - 24
         * 返回：void
         * 操作：初始化按钮窗口；默认不抢键盘焦点，但支持鼠标/触控点击激活。
         */
        this._windowWidth = width;
        Window_Command.prototype.initialize.call(this, x, y);
        this.setBackgroundType(2);
        chaosHideWindowFrame(this);
        this.deactivate();
        this.deselect();
    };
 
    Window_ChaosHudCommands.prototype.windowWidth = function() {
        /**
         * 参数：无
         * 返回：number
         * 操作：固定窗口宽度。
         */
        return this._windowWidth;
    };
 
    Window_ChaosHudCommands.prototype.numVisibleRows = function() {
        /**
         * 参数：无
         * 返回：number，典型值 2
         * 操作：声明可见行数。
         */
        return 2;
    };
 
    Window_ChaosHudCommands.prototype.standardPadding = function() {
        /**
         * 参数：无
         * 返回：number，典型值 10
         * 操作：按钮窗口内边距。
         */
        return 10;
    };
 
    Window_ChaosHudCommands.prototype.makeCommandList = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：构建“存档/读档”两个命令；存档在不允许时自动禁用。
         */
        this.addCommand('存档', 'save', chaosIsSaveAllowedNow());
        this.addCommand('读档', 'load', DataManager && DataManager.isAnySavefileExists ? DataManager.isAnySavefileExists() : true);
    };
 
    Window_ChaosHudCommands.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：
         * - 支持鼠标/触控“单击即触发”按钮，不要求窗口处于 active
         * - 窗口常态保持 inactive，避免抢占键盘方向键导致人物误移动
         * - 定期刷新可用性（例如事件结束后允许存档）
         */
        Window_Command.prototype.update.call(this);
 
        if (Graphics.frameCount % 20 === 0) {
            this.refresh();
        }
 
        if (TouchInput.isTriggered() && this.isTouchedInsideFrame()) {
            var x = this.canvasToLocalX(TouchInput.x);
            var y = this.canvasToLocalY(TouchInput.y);
            var hitIndex = this.hitTest(x, y);
            if (hitIndex >= 0) {
                this.select(hitIndex);
                this.activate();
                this.processOk();
                this.deselect();
            }
        } else if (TouchInput.isTriggered()) {
            this.deactivate();
            this.deselect();
        } else {
            this.deactivate();
        }
    };
 
    Window_ChaosHudCommands.prototype.drawItem = function(index) {
        /**
         * 参数：
         * - index:number 典型值 0 或 1
         * 返回：void
         * 操作：绘制按钮文本；与标题界面保持一致的扁平文本风格。
         */
        var rect = this.itemRectForText(index);
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.contents.fontSize = 20;
        this.drawText(this.commandName(index), rect.x, rect.y, rect.width, 'left');
        this.changePaintOpacity(true);
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
 
        var cmdW = CHAOS_GAME_UI.sidebarWidth - 24;
        var cmdX = 12;
        this._chaosHudCommandWindow = new Window_ChaosHudCommands(cmdX, 0, cmdW);
        this._chaosHudCommandWindow.y = Graphics.boxHeight - this._chaosHudCommandWindow.height - 18;
        this._chaosHudCommandWindow.setHandler('save', this.commandChaosHudSave.bind(this));
        this._chaosHudCommandWindow.setHandler('load', this.commandChaosHudLoad.bind(this));
        this.addWindow(this._chaosHudCommandWindow);

        if (this._mapNameWindow) {
            this._mapNameWindow.x = chaosRightPaneX();
        }

        if (this._messageWindow) {
            chaosApplyMessageLayout(this._messageWindow);
        }

        chaosApplyMapViewport(this);
    };
 
    Scene_Map.prototype.commandChaosHudSave = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：从地图左侧HUD按钮打开存档界面；不允许存档时不执行。
         */
        if (!chaosIsSaveAllowedNow()) {
            if (this._chaosHudCommandWindow) this._chaosHudCommandWindow.activate();
            return;
        }
        if (this._chaosHudCommandWindow) {
            this._chaosHudCommandWindow.deactivate();
            this._chaosHudCommandWindow.deselect();
        }
        SceneManager.push(Scene_Save);
    };
 
    Scene_Map.prototype.commandChaosHudLoad = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：从地图左侧HUD按钮打开读档界面。
         */
        if (this._chaosHudCommandWindow) {
            this._chaosHudCommandWindow.deactivate();
            this._chaosHudCommandWindow.deselect();
        }
        SceneManager.push(Scene_Load);
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
