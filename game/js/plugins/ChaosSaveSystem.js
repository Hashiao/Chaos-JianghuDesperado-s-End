/*:
 * @plugindesc Chaos Save System (Manual Save Slots + Auto Save Slot)
 * @author
 *
 * @help
 * 插件目标（面向策划/非程序员也能用）：
 * 1) 手动存档/读档：沿用 RPG Maker MV 原生的多档位界面。
 * 2) 自动存档：在关键节点由系统写入“自动存档槽位”，避免覆盖玩家手动存档。
 *
 * 事件里插入自动存档的方法（推荐）：
 * - 事件指令 → 插件命令：
 *   CHAOS_AUTOSAVE [可选标签]
 * 例如：
 *   CHAOS_AUTOSAVE S10_A1_进入营地
 *
 * 对话节点里插入自动存档的方法（给程序/数据编写者用）：
 * - 在 node.actions 里加入：
 *   { "type":"autoSave", "tag":"S10_A1_进入营地" }
 */
 
(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：存档系统插件入口。提供：
     * - 额外增加 1 个“自动存档槽位”（显示为 AUTO）
     * - Chaos.Save.autoSave(tag)：在自动存档槽位写入存档
     * - 插件命令 CHAOS_AUTOSAVE：便于非程序员在事件里插入自动存档点
     * - 对话动作 autoSave：通过 Chaos.DialogueRuntime.emit 扩展接入
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
 
    var CHAOS_SAVE_CONFIG = {
        /**
         * 参数：无
         * 返回：void
         * 操作：存档槽位配置。
         * 说明：
         * - baseManualSlots：手动存档槽位数量（原生默认是 20）
         * - autoSlotId：自动存档固定写入的槽位编号（= baseManualSlots + 1）
         */
        baseManualSlots: 20
    };
    CHAOS_SAVE_CONFIG.autoSlotId = CHAOS_SAVE_CONFIG.baseManualSlots + 1;
 
    function chaosGetAutoSlotId() {
        /**
         * 参数：无
         * 返回：number，典型值 21
         * 操作：返回“自动存档槽位编号”。
         */
        return CHAOS_SAVE_CONFIG.autoSlotId;
    }
 
    function chaosIsAutoSlot(savefileId) {
        /**
         * 参数：
         * - savefileId: number，典型值 1..21
         * 返回：boolean
         * 操作：判断给定槽位是否为“自动存档槽位”。
         */
        return Number(savefileId) === chaosGetAutoSlotId();
    }
 
    function chaosEnsureAutosaveState() {
        /**
         * 参数：无
         * 返回：object|null，典型值 { enabled:true, lastTag:'', lastTimestamp:0 }
         * 操作：确保存档中存在 autosave 状态字段，便于 UI/排查/统计。
         */
        if (!$gameSystem) return null;
        if (!$gameSystem._chaosAutosaveState) {
            $gameSystem._chaosAutosaveState = {
                enabled: true,
                lastTag: '',
                lastTimestamp: 0
            };
        }
        return $gameSystem._chaosAutosaveState;
    }
 
    function chaosSetAutosaveMeta(tag) {
        /**
         * 参数：
         * - tag: string，典型值 'S10_A1_进入营地'
         * 返回：void
         * 操作：记录最近一次自动存档的标签与时间戳（写入存档）。
         */
        var st = chaosEnsureAutosaveState();
        if (!st) return;
        st.lastTag = String(tag || '');
        st.lastTimestamp = Date.now();
    }
 
    function chaosAutoSave(tag) {
        /**
         * 参数：
         * - tag: string，典型值 'S10_A1_进入营地'（可空）
         * 返回：boolean，true=成功，false=失败
         * 操作：
         * - 触发一次“自动存档”写入固定槽位（AUTO）。
         * - 该方法可以在：对话节点动作、地图事件、脚本调用中使用。
         *
         * 给非程序员的使用提示：
         * - 你不需要理解 DataManager/StorageManager。
         * - 只要在关键事件里插入插件命令：CHAOS_AUTOSAVE 标签
         * - 标签用于日后排查“这个自动存档点是什么位置”，不影响功能。
         */
        var st = chaosEnsureAutosaveState();
        if (st && st.enabled === false) return false;
 
        if (!$gameSystem || !DataManager) return false;
        var slotId = chaosGetAutoSlotId();
 
        $gameSystem.onBeforeSave();
        var ok = DataManager.saveGame(slotId);
        if (ok && StorageManager && StorageManager.cleanBackup) {
            StorageManager.cleanBackup(slotId);
        }
        if (ok) chaosSetAutosaveMeta(tag);
        return !!ok;
    }
 
    Chaos.Save = Chaos.Save || {
        /**
         * 参数：无
         * 返回：void
         * 操作：占位命名空间，后续可扩展更多存档相关能力。
         */
    };
    Chaos.Save.autoSave = chaosAutoSave;
    Chaos.Save.autoSlotId = chaosGetAutoSlotId;
 
    var _DataManager_maxSavefiles = DataManager.maxSavefiles;
    DataManager.maxSavefiles = function() {
        /**
         * 参数：无
         * 返回：number，典型值 21
         * 操作：在原生最大存档数基础上 +1，预留一个 AUTO 槽位。
         * 说明：原生默认 20；本插件固定使用 21 作为自动存档。
         */
        var base = CHAOS_SAVE_CONFIG.baseManualSlots;
        if (typeof _DataManager_maxSavefiles === 'function') {
            /**
             * 参数：无
             * 返回：void
             * 操作：如果未来你改过原生 maxSavefiles，这里也尽量兼容。
             * 但为了让 AUTO 槽位稳定，我们仍优先用 baseManualSlots 作为手动槽位数量。
             */
        }
        return base + 1;
    };
 
    var _Window_SavefileList_drawFileId = Window_SavefileList.prototype.drawFileId;
    Window_SavefileList.prototype.drawFileId = function(id, x, y) {
        /**
         * 参数：
         * - id:number 典型值 1..21
         * - x/y:number 绘制坐标
         * 返回：void
         * 操作：把自动存档槽位显示为 “AUTO”，其余保持原生 “File N”。
         */
        if (chaosIsAutoSlot(id)) {
            this.changeTextColor('#66aaff');
            this.drawText('AUTO', x, y, 180);
            this.resetTextColor();
            return;
        }
        _Window_SavefileList_drawFileId.call(this, id, x, y);
    };
 
    Window_SavefileList.prototype.isCurrentItemEnabled = function() {
        /**
         * 参数：无
         * 返回：boolean
         * 操作：在“保存界面”禁用 AUTO 槽位，避免玩家手动覆盖自动存档。
         * 说明：读档界面仍可选择 AUTO 槽位进行读取。
         */
        if (this._mode === 'save') {
            var id = this.index() + 1;
            if (chaosIsAutoSlot(id)) return false;
        }
        return true;
    };
 
    var _Window_SavefileList_drawItem = Window_SavefileList.prototype.drawItem;
    Window_SavefileList.prototype.drawItem = function(index) {
        /**
         * 参数：
         * - index:number 典型值 0..maxItems-1
         * 返回：void
         * 操作：在保存界面中把 AUTO 槽位绘制为不可用（灰掉），提升可理解性。
         */
        var id = index + 1;
        if (this._mode === 'save' && chaosIsAutoSlot(id)) {
            this.changePaintOpacity(false);
            _Window_SavefileList_drawItem.call(this, index);
            this.changePaintOpacity(true);
            return;
        }
        _Window_SavefileList_drawItem.call(this, index);
    };
 
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        /**
         * 参数：
         * - command:string 典型值 'CHAOS_AUTOSAVE'
         * - args:Array<string> 典型值 ['S10_A1_进入营地']
         * 返回：void
         * 操作：支持事件里插入自动存档点。
         * 用法：CHAOS_AUTOSAVE [标签]
         */
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (!command) return;
        if (String(command).toUpperCase() === 'CHAOS_AUTOSAVE') {
            var tag = (args && args.length > 0) ? String(args.join(' ')) : '';
            chaosAutoSave(tag);
        }
    };
 
    function chaosHookDialogueAutosave() {
        /**
         * 参数：无
         * 返回：void
         * 操作：把对话动作 type=autoSave 接入到自动存档实现。
         * 说明：ChaosDialogues 对未知动作会 emit(type,payload)。本插件只需订阅一次即可。
         */
        if (!Chaos || !Chaos.DialogueRuntime || !Chaos.DialogueRuntime.on) return;
        Chaos.DialogueRuntime.on('autoSave', function(payload) {
            /**
             * 参数：
             * - payload: object，典型值 {type:'autoSave', tag:'S10_A1_进入营地'}
             * 返回：void
             * 操作：响应对话节点动作，执行自动存档。
             */
            if (!payload) return;
            chaosAutoSave(payload.tag || '');
        });
    }
 
    chaosHookDialogueAutosave();
 })();
