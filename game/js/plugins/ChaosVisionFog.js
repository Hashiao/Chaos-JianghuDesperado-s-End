/*:
 * @plugindesc Chaos Vision Fog (Tile-based)
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：实现“以主角为中心的视野雾化遮罩”。业务目标如下：
     * - 以主角所在格为中心：
     *   - 3×3 范围：完全清晰（无遮罩）
     *   - 4×4 到 7×7：快速变灰/变白雾（越远越看不清）
     *   - 8×8 开始：白雾极浓到看不清（不再用纯黑，避免突兀）
     * - 主角移动/镜头滚动时，遮罩始终以主角为中心实时更新。
     *
     * 重要说明：
     * - 本遮罩只处理“视觉显示”，不改地图通行、事件、战斗等逻辑。
     * - 遮罩会挂在 Spriteset_Map._tilemap 上，因此会自动跟随你现有的“右侧主区域缩放/偏移”布局。
     * - 是否启用遮罩由 $gameSystem._chaosMainAreaOverlayMode 控制：
     *   - mode === 'fade_to_fog'：开始渐入（用于“睁眼”瞬间就进入视野限制，且过渡更柔和）
     *   - mode === 'fog'：保持开启
     *
     * 如何调整 3×3 与 7×7（以及“8×8开始不可见”）：
     * - 修改下面配置 CHAOS_VISION_FOG.nearSize / farSize（必须为奇数，例如 3、5、7、9）。
     * - nearSize=3 表示“以主角为中心，向外 1 格”的范围（半径 = (3-1)/2）。
     * - farSize=7 表示“以主角为中心，向外 3 格”的范围（半径 = (7-1)/2）。
     * - 视野完全不可见从“farSize 外一圈”开始（例如 farSize=7，则 dist>=4 对应 8×8 开始全黑）。
     */
    'use strict';

    var CHAOS_VISION_FOG = {
        /**
         * 参数：无
         * 返回：void
         * 操作：业务可配置项。\n+         * - nearSize / farSize：两者都必须为奇数。\n+         * - fogAlphaNear：从 nearSize 外一圈开始的雾强度（0..1）。\n+         * - fogAlphaFar：到 farSize 边界时的雾强度（0..1）。\n+         * - fullFogAlpha：超出 farSize 后的雾强度（0..1，通常为 1）。\n+         * - fogColor：雾的颜色（越白越像“白雾浓到看不清”）。\n+         * - curvePower：雾强度增长速度，越大越“快速变灰”。\n+         * - transitionFrames：从 fade_to_fog 渐入到 fog 的过渡帧数（越大越柔和）。\n+         * - noiseEnabled：是否在“浓雾区（8×8外）”加入轻微噪点纹理。\n+         * - noiseAlphaAmplitude：噪点造成的透明度扰动幅度（0..1），越大越“颗粒”。\n+         * - noiseColorAmplitude：噪点造成的颜色扰动幅度（0..255），越大越“花”。\n+         * - noiseUpdateIntervalFrames：噪点刷新间隔（帧）。越大变化越慢；0 表示完全静态。
         */
        nearSize: 3,
        farSize: 7,
        fogAlphaNear: 0.15,
        fogAlphaFar: 0.85,
        fullFogAlpha: 1.0,
        fogColor: { r: 220, g: 220, b: 220 },
        curvePower: 2.0
        ,
        transitionFrames: 70,
        noiseEnabled: true,
        noiseAlphaAmplitude: 0.12,
        noiseColorAmplitude: 10,
        noiseUpdateIntervalFrames: 12
    };

    function clamp01(v) {
        /**
         * 参数：
         * - v: number，典型值 0.3 / 1.2 / -0.1
         * 返回：number，范围 0..1
         * 操作：把输入裁剪到 [0,1]。
         */
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    function ensureOddPositive(n, fallback) {
        /**
         * 参数：
         * - n: number，典型值 3 / 4 / -1
         * - fallback: number，典型值 3
         * 返回：number，正奇数
         * 操作：确保返回值为“正奇数”；否则用 fallback。
         */
        var v = Number(n);
        if (!isFinite(v)) return fallback;
        v = Math.floor(v);
        if (v <= 0) return fallback;
        if (v % 2 === 0) v = v + 1;
        return v;
    }

    function tileRadiusFromSize(size) {
        /**
         * 参数：
         * - size: number，典型值 3/7
         * 返回：number，典型值 1/3
         * 操作：把“奇数边长”换算成“向外半径(格数)”：radius = (size-1)/2。
         */
        var s = ensureOddPositive(size, 3);
        return Math.floor((s - 1) / 2);
    }

    function hashToUnitFloat(x, y, seed) {
        /**
         * 参数：
         * - x: number，典型值 地图格子x（整数）
         * - y: number，典型值 地图格子y（整数）
         * - seed: number，典型值 0 / 10 / 100（整数）
         * 返回：number，范围 0..1
         * 操作：生成一个“确定性伪随机数”。\n+         * 说明：同样的 (x,y,seed) 永远得到同样的结果，用于做“雾的噪点纹理”。
         */
        var n = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791);
        n = (n << 13) ^ n;
        var nn = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
        return nn / 2147483647;
    }

    function Sprite_ChaosVisionFog() {
        /**
         * 参数：无
         * 返回：void
         * 操作：视野雾化遮罩精灵。内部用一个 Bitmap 每次重绘整屏。
         */
        this.initialize.apply(this, arguments);
    }

    Sprite_ChaosVisionFog.prototype = Object.create(Sprite.prototype);
    Sprite_ChaosVisionFog.prototype.constructor = Sprite_ChaosVisionFog;

    Sprite_ChaosVisionFog.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：初始化遮罩位图与缓存字段。
         */
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(Graphics.width, Graphics.height);
        this.z = 100;
        this._lastKey = '';
        this._fogAlpha = 0;
        this._transitionIndex = 0;
        this._lastMode = '';
        this._noiseTick = 0;
    };

    Sprite_ChaosVisionFog.prototype.update = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：每帧根据主角/镜头变化判断是否需要重绘。\n+         * 仅在 $gameSystem._chaosMainAreaOverlayMode === 'fog' 时显示。
         */
        Sprite.prototype.update.call(this);
        var mode = ($gameSystem && $gameSystem._chaosMainAreaOverlayMode) ? String($gameSystem._chaosMainAreaOverlayMode) : 'hidden';
        this._updateTransition(mode);
        this._updateNoiseTick();
        if (this._fogAlpha <= 0) {
            this.visible = false;
            return;
        }
        this.visible = true;

        if (!$gameMap || !$gamePlayer) return;
        if (!this.bitmap || this.bitmap.width !== Graphics.width || this.bitmap.height !== Graphics.height) {
            this.bitmap = new Bitmap(Graphics.width, Graphics.height);
        }

        var key = this._buildKey();
        if (key !== this._lastKey) {
            this._lastKey = key;
            this._redraw();
        }
    };

    Sprite_ChaosVisionFog.prototype._buildKey = function() {
        /**
         * 参数：无
         * 返回：string，用于判断是否需要重绘
         * 操作：把影响可视结果的关键量拼成一个 key：\n+         * - 主角格子坐标（x,y）\n+         * - 镜头滚动（displayX,displayY）\n+         * - 屏幕尺寸（Graphics.width/height）\n+         * - 配置（nearSize/farSize/nearGrayAlpha/curvePower）
         */
        var displayX = $gameMap.displayX ? $gameMap.displayX() : 0;
        var displayY = $gameMap.displayY ? $gameMap.displayY() : 0;
        var alphaKey = Math.round(this._fogAlpha * 100) / 100;
        return [
            $gamePlayer.x, $gamePlayer.y,
            displayX, displayY,
            Graphics.width, Graphics.height,
            CHAOS_VISION_FOG.nearSize, CHAOS_VISION_FOG.farSize,
            CHAOS_VISION_FOG.fogAlphaNear, CHAOS_VISION_FOG.fogAlphaFar, CHAOS_VISION_FOG.fullFogAlpha,
            CHAOS_VISION_FOG.curvePower,
            alphaKey,
            CHAOS_VISION_FOG.noiseEnabled, CHAOS_VISION_FOG.noiseAlphaAmplitude, CHAOS_VISION_FOG.noiseColorAmplitude,
            CHAOS_VISION_FOG.noiseUpdateIntervalFrames,
            this._noiseTick
        ].join('|');
    };

    Sprite_ChaosVisionFog.prototype._updateTransition = function(mode) {
        /**
         * 参数：
         * - mode: string，典型值 'hidden'|'black'|'fade_to_fog'|'fog'
         * 返回：void
         * 操作：根据遮罩模式更新“雾显示强度 _fogAlpha”，用于解决两类问题：\n+         * 1) 睁眼后立刻进入“近处可见、远处不可见”，避免先全可见再突变。\n+         * 2) 让 fog 的出现/消失有渐变过渡，减少生硬感。
         */
        if (mode === 'fog') {
            this._fogAlpha = 1;
            this._transitionIndex = ensureOddPositive(CHAOS_VISION_FOG.transitionFrames, 1);
            this._lastMode = mode;
            return;
        }

        if (mode === 'fade_to_fog') {
            if (this._lastMode !== 'fade_to_fog') {
                this._transitionIndex = 0;
            }
            var frames = ensureOddPositive(CHAOS_VISION_FOG.transitionFrames, 1);
            this._transitionIndex = Math.min(frames, this._transitionIndex + 1);
            this._fogAlpha = clamp01(this._transitionIndex / frames);
            this._lastMode = mode;
            return;
        }

        this._fogAlpha = 0;
        this._transitionIndex = 0;
        this._lastMode = mode;
    };

    Sprite_ChaosVisionFog.prototype._updateNoiseTick = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：更新噪点时间片（用于让浓雾区“轻微流动”，减少静态块状感）。\n+         * 说明：\n+         * - noiseUpdateIntervalFrames=12 表示每 12 帧变化一次。\n+         * - 设置为 0 表示噪点完全静态。
         */
        var interval = Number(CHAOS_VISION_FOG.noiseUpdateIntervalFrames);
        if (!isFinite(interval)) interval = 12;
        interval = Math.max(0, Math.floor(interval));
        if (interval === 0) {
            this._noiseTick = 0;
            return;
        }
        this._noiseTick = Math.floor(Graphics.frameCount / interval);
    };

    Sprite_ChaosVisionFog.prototype._fogRgba = function(alpha) {
        /**
         * 参数：
         * - alpha: number，典型值 0.5
         * 返回：string，典型值 'rgba(220,220,220,0.5)'
         * 操作：根据配置 fogColor 生成 rgba 字符串。
         */
        var c = CHAOS_VISION_FOG.fogColor || { r: 220, g: 220, b: 220 };
        var r = Math.max(0, Math.min(255, Number(c.r)));
        var g = Math.max(0, Math.min(255, Number(c.g)));
        var b = Math.max(0, Math.min(255, Number(c.b)));
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    };

    Sprite_ChaosVisionFog.prototype._fogRgbaCustom = function(r, g, b, alpha) {
        /**
         * 参数：
         * - r/g/b: number，典型值 220/220/220
         * - alpha: number，典型值 0.8
         * 返回：string，典型值 'rgba(220,220,220,0.8)'
         * 操作：按指定颜色返回 rgba 字符串（用于噪点轻微调色）。
         */
        var rr = Math.max(0, Math.min(255, Number(r)));
        var gg = Math.max(0, Math.min(255, Number(g)));
        var bb = Math.max(0, Math.min(255, Number(b)));
        return 'rgba(' + rr + ',' + gg + ',' + bb + ',' + alpha + ')';
    };

    Sprite_ChaosVisionFog.prototype._redraw = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：重绘整张雾化遮罩位图。\n+         * 逻辑：按“格子”为单位绘制矩形遮罩，并根据与主角的格子距离决定透明度/颜色。
         */
        var bmp = this.bitmap;
        if (!bmp) return;
        bmp.clear();

        var nearRadius = tileRadiusFromSize(CHAOS_VISION_FOG.nearSize);
        var farRadius = tileRadiusFromSize(CHAOS_VISION_FOG.farSize);
        if (farRadius < nearRadius) farRadius = nearRadius;

        var tw = $gameMap.tileWidth ? $gameMap.tileWidth() : 48;
        var th = $gameMap.tileHeight ? $gameMap.tileHeight() : 48;

        var displayX = $gameMap.displayX ? $gameMap.displayX() : 0;
        var displayY = $gameMap.displayY ? $gameMap.displayY() : 0;

        var startTileX = Math.floor(displayX);
        var startTileY = Math.floor(displayY);
        var offsetPxX = -Math.round((displayX - startTileX) * tw);
        var offsetPxY = -Math.round((displayY - startTileY) * th);

        var tilesX = Math.ceil(Graphics.width / tw) + 2;
        var tilesY = Math.ceil(Graphics.height / th) + 2;

        var px = $gamePlayer.x;
        var py = $gamePlayer.y;

        var fogAlphaNear = clamp01(Number(CHAOS_VISION_FOG.fogAlphaNear));
        var fogAlphaFar = clamp01(Number(CHAOS_VISION_FOG.fogAlphaFar));
        var fullFogAlpha = clamp01(Number(CHAOS_VISION_FOG.fullFogAlpha));
        var curve = Number(CHAOS_VISION_FOG.curvePower);
        if (!isFinite(curve) || curve <= 0) curve = 2.0;

        var globalAlpha = clamp01(Number(this._fogAlpha));
        var noiseEnabled = !!CHAOS_VISION_FOG.noiseEnabled;
        var noiseAlphaAmp = clamp01(Number(CHAOS_VISION_FOG.noiseAlphaAmplitude));
        var noiseColorAmp = Number(CHAOS_VISION_FOG.noiseColorAmplitude);
        if (!isFinite(noiseColorAmp)) noiseColorAmp = 0;
        noiseColorAmp = Math.max(0, Math.floor(noiseColorAmp));
        var baseColor = CHAOS_VISION_FOG.fogColor || { r: 220, g: 220, b: 220 };
        var baseR = Math.max(0, Math.min(255, Number(baseColor.r)));
        var baseG = Math.max(0, Math.min(255, Number(baseColor.g)));
        var baseB = Math.max(0, Math.min(255, Number(baseColor.b)));

        for (var j = 0; j < tilesY; j++) {
            var mapY = $gameMap.roundY ? $gameMap.roundY(startTileY + j) : (startTileY + j);
            var dy = $gameMap.deltaY ? $gameMap.deltaY(mapY, py) : (mapY - py);
            var ady = Math.abs(dy);
            var y = offsetPxY + j * th;

            for (var i = 0; i < tilesX; i++) {
                var mapX = $gameMap.roundX ? $gameMap.roundX(startTileX + i) : (startTileX + i);
                var dx = $gameMap.deltaX ? $gameMap.deltaX(mapX, px) : (mapX - px);
                var adx = Math.abs(dx);
                var dist = Math.max(adx, ady);
                var x = offsetPxX + i * tw;

                if (dist <= nearRadius) {
                    continue;
                } else if (dist <= farRadius) {
                    var t = (dist - nearRadius) / Math.max(1, (farRadius - nearRadius));
                    t = clamp01(t);
                    var k = Math.pow(t, curve);
                    var a = fogAlphaNear + (fogAlphaFar - fogAlphaNear) * k;
                    a = clamp01(a);
                    bmp.fillRect(x, y, tw, th, this._fogRgba(a * globalAlpha));
                } else {
                    var aa = clamp01(fullFogAlpha * globalAlpha);
                    if (noiseEnabled && (noiseAlphaAmp > 0 || noiseColorAmp > 0)) {
                        var n = hashToUnitFloat(mapX, mapY, this._noiseTick);
                        var t2 = (n - 0.5) * 2;
                        aa = clamp01(aa + t2 * noiseAlphaAmp);
                        if (noiseColorAmp > 0) {
                            var dr = Math.floor(t2 * noiseColorAmp);
                            bmp.fillRect(x, y, tw, th, this._fogRgbaCustom(baseR + dr, baseG + dr, baseB + dr, aa));
                        } else {
                            bmp.fillRect(x, y, tw, th, this._fogRgba(aa));
                        }
                    } else {
                        bmp.fillRect(x, y, tw, th, this._fogRgba(aa));
                    }
                }
            }
        }
    };

    function chaosEnsureVisionFog(spriteset) {
        /**
         * 参数：
         * - spriteset: Spriteset_Map，典型值 Scene_Map._spriteset
         * 返回：void
         * 操作：确保视野雾化遮罩已挂载到 tilemap 上（只创建一次）。
         */
        if (!spriteset || !spriteset._tilemap) return;
        if (spriteset._chaosVisionFog) return;
        var fog = new Sprite_ChaosVisionFog();
        spriteset._tilemap.addChild(fog);
        spriteset._chaosVisionFog = fog;
    }

    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：在地图精灵组创建完底层后，挂载视野雾化遮罩到 tilemap。
         */
        _Spriteset_Map_createLowerLayer.call(this);
        chaosEnsureVisionFog(this);
    };
})();
