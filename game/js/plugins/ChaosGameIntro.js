(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：RPG Maker MV 插件入口：实现“进入地图后游戏主区域黑屏”和“开场对白自动播放”。
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

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：初始化开场相关的存档字段：
         * - _chaosIntroPlayed：是否已触发过开场对话（仅新档首次进入地图触发一次）
         * - _chaosMainAreaOverlayMode：右上主区域遮罩模式（black/fog/fade_to_fog/hidden）
         * - _chaosSingleActorOnly：是否只显示主角（隐藏followers）
         */
        _Game_System_initialize.call(this);
        this._chaosIntroPlayed = false;
        this._chaosMainAreaOverlayMode = CHAOS_INTRO_CONFIG.enableBlackMainArea ? 'black' : 'hidden';
        this._chaosSingleActorOnly = CHAOS_INTRO_CONFIG.singleActorOnly;
    };

    function chaosEnsureOverlay(sceneMap) {
        /**
         * 参数：
         * - sceneMap: Scene_Map，典型值 SceneManager._scene
         * 返回：void
         * 操作：确保地图场景挂载“右上主区域遮罩控制器”实例，避免重复创建。
         */
        if (!sceneMap._chaosMainAreaOverlay) sceneMap._chaosMainAreaOverlay = new ChaosMainAreaOverlay(sceneMap);
    }

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：地图场景开始时：
         * - 初始化/应用右上主区域遮罩
         * - 根据配置隐藏followers，仅显示主角
         * - 新档首次进入地图时启动数据驱动对话（INTRO -> COLD）
         */
        _Scene_Map_start.call(this);

        chaosEnsureOverlay(this);

        if ($gameSystem && $gameSystem._chaosSingleActorOnly) {
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

        if ($gameSystem && !$gameSystem._chaosIntroPlayed && root.Chaos && root.Chaos.DialogueRuntime) {
            root.Chaos.DialogueRuntime.start('INTRO', 'COLD', this._messageWindow || null);
            $gameSystem._chaosIntroPlayed = true;
        }
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：每帧同步遮罩模式并推进渐变动画（black -> fog）。
         */
        _Scene_Map_update.call(this);
        if (!this._chaosMainAreaOverlay) return;
        var mode = $gameSystem ? $gameSystem._chaosMainAreaOverlayMode : 'hidden';
        if (this._chaosMainAreaOverlay.setMode) this._chaosMainAreaOverlay.setMode(mode);
        if (this._chaosMainAreaOverlay.update) this._chaosMainAreaOverlay.update();
    };
})();
