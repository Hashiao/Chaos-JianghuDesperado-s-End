/*:
 * @plugindesc Chaos Skill Checks (D20 + Animation)
 * @author
 *
 * @help
 * 用法（给对话/事件脚本编写者）：
 * - 对话动作：{ type:'skillCheck', check:{type:'per', difficulty:8, baseBonus:4, bonusName:'鹰隼之眼'}, successNode:'X', failNode:'Y' }
 *
 * 说明：
 * - type 目前支持：str / agi / per / luk
 * - 投 1：大失败必失败；投 20：大成功必成功；否则比较 (roll+bonus) >= difficulty
 */
 
(function() {
    'use strict';
 
    var root = (function() { return this || (0, eval)('this'); })();
    var Chaos = root.Chaos = root.Chaos || {};
 
    function clamp(n, min, max) {
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }
 
    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
 
    function normalizeCheckType(t) {
        var s = String(t || '').toLowerCase();
        if (s === '力量' || s === 'str') return 'str';
        if (s === '敏捷' || s === 'agi') return 'agi';
        if (s === '感知' || s === 'per') return 'per';
        if (s === '幸运' || s === 'luk') return 'luk';
        return 'per';
    }
 
    function formatSigned(n) {
        var v = Number(n) || 0;
        if (v >= 0) return '+' + v;
        return String(v);
    }
 
    function Window_ChaosCheckOverlay() {
        this.initialize.apply(this, arguments);
    }
 
    Window_ChaosCheckOverlay.prototype = Object.create(Window_Base.prototype);
    Window_ChaosCheckOverlay.prototype.constructor = Window_ChaosCheckOverlay;
 
    Window_ChaosCheckOverlay.prototype.initialize = function() {
        Window_Base.prototype.initialize.call(this, 0, 0, Graphics.boxWidth, Graphics.boxHeight);
        this.opacity = 0;
        this.backOpacity = 0;
        if (this._windowFrameSprite) this._windowFrameSprite.visible = false;
        this.contentsOpacity = 255;
        this.z = 10000;
        this.visible = false;
        this.deactivate();
 
        this._active = false;
        this._frame = 0;
        this._phase = 'idle';
        this._spec = null;
        this._done = null;
        this._result = null;
        this._prevInputLocked = null;
 
        this._rollDisplay = 1;
        this._bonusX = -9999;
        this._bonusY = 0;
        this._bonusAlpha = 0;
    };
 
    Window_ChaosCheckOverlay.prototype.start = function(spec, done) {
        if (this._active) return false;
        this._spec = spec || {};
        this._done = done || null;
        this._frame = 0;
        this._phase = 'rolling';
        this._active = true;
        this.visible = true;
        this._result = null;
 
        this._rollDisplay = randInt(1, 20);
        this._bonusX = -300;
        this._bonusAlpha = 0;
 
        if ($gameSystem) {
            this._prevInputLocked = !!$gameSystem._chaosPlayerInputLocked;
            $gameSystem._chaosPlayerInputLocked = true;
        } else {
            this._prevInputLocked = null;
        }
        this.refresh();
        return true;
    };
 
    Window_ChaosCheckOverlay.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        if (!this._active) return;
 
        var durationFrames = Math.max(1, Number(this._spec && this._spec.durationFrames) || 180);
        var centerX = Math.floor(Graphics.boxWidth / 2);
        var centerY = Math.floor(Graphics.boxHeight / 2);
        this._bonusY = centerY - 10;
 
        if (this._phase === 'rolling') {
            this._rollDisplay = randInt(1, 20);
            if (this._frame >= durationFrames) {
                this._finalizeResult();
                this._phase = 'bonus_fly';
                this._frame = 0;
            }
        } else if (this._phase === 'bonus_fly') {
            var flyFrames = 24;
            var t = clamp(this._frame / flyFrames, 0, 1);
            var startX = -280;
            var endX = centerX - 140;
            this._bonusX = Math.floor(startX + (endX - startX) * t);
            this._bonusAlpha = t;
            if (this._frame >= flyFrames) {
                this._phase = 'result';
                this._frame = 0;
            }
        } else if (this._phase === 'result') {
            var holdFrames = 60;
            if (this._frame >= holdFrames) {
                this._finish();
                return;
            }
        }
 
        this.refresh();
        this._frame++;
    };
 
    Window_ChaosCheckOverlay.prototype._finalizeResult = function() {
        var check = this._spec || {};
        var roll = randInt(1, 20);
        var baseBonus = Number(check.baseBonus) || 0;
        var difficulty = Number(check.difficulty) || 0;
        var crit = '';
        var success = false;
 
        if (roll === 1) {
            crit = 'crit_fail';
            success = false;
        } else if (roll === 20) {
            crit = 'crit_success';
            success = true;
        } else {
            success = (roll + baseBonus) >= difficulty;
        }
 
        this._rollDisplay = roll;
        this._result = {
            type: normalizeCheckType(check.type),
            difficulty: difficulty,
            roll: roll,
            baseBonus: baseBonus,
            total: roll + baseBonus,
            success: !!success,
            crit: crit
        };
    };
 
    Window_ChaosCheckOverlay.prototype._finish = function() {
        this._active = false;
        this.visible = false;
        this._phase = 'idle';
        this.contents.clear();
 
        if ($gameSystem && this._prevInputLocked !== null) {
            $gameSystem._chaosPlayerInputLocked = !!this._prevInputLocked;
        }
 
        var cb = this._done;
        var result = this._result;
        this._done = null;
        this._spec = null;
        this._result = null;
        this._prevInputLocked = null;
 
        if (cb) {
            try { cb(result); } catch (e) {}
        }
    };
 
    Window_ChaosCheckOverlay.prototype.refresh = function() {
        this.contents.clear();
        this._redraw(Math.floor(Graphics.boxWidth / 2), Math.floor(Graphics.boxHeight / 2));
    };
 
    Window_ChaosCheckOverlay.prototype._redraw = function(centerX, centerY) {
        var bmp = this.contents;
        bmp.clear();
 
        bmp.paintOpacity = 200;
        bmp.fillRect(0, 0, this.contentsWidth(), this.contentsHeight(), '#000000');
        bmp.paintOpacity = 255;
 
        var panelW = 520;
        var panelH = 220;
        var px = Math.floor(centerX - panelW / 2) - this.standardPadding();
        var py = Math.floor(centerY - panelH / 2) - this.standardPadding();
        bmp.fillRect(px, py, panelW, panelH, 'rgba(20,20,20,0.92)');
        bmp.fillRect(px, py, panelW, 2, 'rgba(255,255,255,0.15)');
 
        var check = this._spec || {};
        var typeName = '';
        var t = normalizeCheckType(check.type);
        if (t === 'str') typeName = '力量';
        else if (t === 'agi') typeName = '敏捷';
        else if (t === 'per') typeName = '感知';
        else if (t === 'luk') typeName = '幸运';
 
        bmp.fontSize = 22;
        bmp.textColor = '#ffffff';
        bmp.drawText(typeName + '检定', px + 24, py + 18, 240, 28, 'left');
 
        bmp.fontSize = 18;
        bmp.textColor = '#cccccc';
        var difficulty = Number(check.difficulty) || 0;
        bmp.drawText('难度 ' + difficulty, px + 24, py + 50, 240, 24, 'left');
 
        var diceBoxW = 120;
        var diceBoxH = 120;
        var dx = Math.floor(centerX - diceBoxW / 2) - this.standardPadding();
        var dy = py + 60;
        bmp.fillRect(dx, dy, diceBoxW, diceBoxH, 'rgba(0,0,0,0.35)');
        bmp.fillRect(dx, dy, diceBoxW, 2, 'rgba(255,255,255,0.10)');
        bmp.fillRect(dx, dy + diceBoxH - 2, diceBoxW, 2, 'rgba(255,255,255,0.10)');
 
        bmp.fontSize = 64;
        bmp.textColor = '#ffffff';
        bmp.drawText(String(this._rollDisplay), dx, dy + 20, diceBoxW, 80, 'center');
 
        if (this._phase === 'bonus_fly' || this._phase === 'result') {
            var bonusName = String(check.bonusName || '');
            var baseBonus = Number(check.baseBonus) || 0;
            var bonusText = (bonusName ? bonusName + ' ' : '') + formatSigned(baseBonus);
            bmp.fontSize = 20;
            bmp.textColor = '#66aaff';
            bmp.paintOpacity = Math.floor(255 * clamp(this._bonusAlpha, 0, 1));
            bmp.drawText(bonusText, this._bonusX - this.standardPadding(), this._bonusY - this.standardPadding(), 320, 28, 'left');
            bmp.paintOpacity = 255;
 
            bmp.fontSize = 18;
            bmp.textColor = '#cccccc';
            bmp.drawText('总计 ' + String((this._result ? this._result.total : (this._rollDisplay + baseBonus))), px + panelW - 180, py + 50, 160, 24, 'right');
        }
 
        if (this._phase === 'result' && this._result) {
            var ok = !!this._result.success;
            bmp.fontSize = 54;
            bmp.textColor = ok ? '#00dd66' : '#ff3344';
            bmp.drawText(ok ? '成功' : '失败', px, py + 150, panelW, 60, 'center');
 
            if (this._result.crit === 'crit_fail' || this._result.crit === 'crit_success') {
                bmp.fontSize = 20;
                bmp.textColor = '#ffffff';
                bmp.drawText(this._result.crit === 'crit_fail' ? '大失败（掷出 1）' : '大成功（掷出 20）', px, py + 20, panelW, 24, 'center');
            }
        } else if (this._phase === 'rolling') {
            bmp.fontSize = 18;
            bmp.textColor = '#cccccc';
            bmp.drawText('掷骰中…', px, py + 190, panelW, 24, 'center');
        }
    };
 
    function ensureOverlayWindow(scene) {
        if (!scene || !scene.addWindow) return null;
        if (scene._chaosCheckWindow) return scene._chaosCheckWindow;
        var w = new Window_ChaosCheckOverlay();
        scene._chaosCheckWindow = w;
        scene.addWindow(w);
        return w;
    }
 
    Chaos.Checks = Chaos.Checks || {};
    Chaos.Checks._pending = null;
 
    Chaos.Checks.start = function(spec, done) {
        var scene = SceneManager && SceneManager._scene ? SceneManager._scene : null;
        var overlay = ensureOverlayWindow(scene);
        if (!overlay) {
            if (Chaos.DebugConsole && Chaos.DebugConsole.warn) Chaos.DebugConsole.warn('Checks.start: no overlay window (scene missing addWindow)', spec);
            var check = spec || {};
            var roll = randInt(1, 20);
            var baseBonus = Number(check.baseBonus) || 0;
            var difficulty = Number(check.difficulty) || 0;
            var crit = '';
            var success = false;
            if (roll === 1) { crit = 'crit_fail'; success = false; }
            else if (roll === 20) { crit = 'crit_success'; success = true; }
            else { success = (roll + baseBonus) >= difficulty; }
            var result = { type: normalizeCheckType(check.type), difficulty: difficulty, roll: roll, baseBonus: baseBonus, total: roll + baseBonus, success: !!success, crit: crit };
            if (done) done(result);
            return false;
        }
        if (Chaos.DebugConsole && Chaos.DebugConsole.log) Chaos.DebugConsole.log('Checks.start: begin', spec);
        return overlay.start(spec, done);
    };
 
    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        ensureOverlayWindow(this);
    };
})();
