/*:
 * @plugindesc Chaos Character Stats (Save Data)
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：角色“动态属性/数值表”插件入口。
     * 设计目标：
     * - 角色档案（ChaosCharacters）存“角色是谁”（UID、名字等）+ 默认值模板（默认-1无效）。
     * - 角色数值（本文件）存“角色现在是什么状态”（HP/命中等），并写入存档（$gameSystem）。
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

    function toInt32(value, fallback) {
        /**
         * 参数：
         * - value: any，典型值 3 / "3" / null
         * - fallback: number，典型值 -1
         * 返回：number，32位整数；若 value 无法转换则返回 fallback
         * 操作：把输入安全转换为 32 位整数。用于 HP/MP 这类“必须是整数”的数值字段。
         */
        var n = Number(value);
        if (!isFinite(n)) return fallback;
        return n | 0;
    }

    function toFloat(value, fallback) {
        /**
         * 参数：
         * - value: any，典型值 0.15 / "0.15" / 3 / null
         * - fallback: number，典型值 -1
         * 返回：number，浮点数；若 value 无法转换则返回 fallback
         * 操作：把输入安全转换为浮点数。用于 hit/def/eva/blk（目前只用于剧情/显示，不参与战斗）。
         */
        var n = Number(value);
        if (!isFinite(n)) return fallback;
        return n;
    }

    function defaultStatsTemplate() {
        /**
         * 参数：无
         * 返回：object，典型值 {maxHp:-1, hp:-1, ...}
         * 操作：生成一份默认属性模板（全部 -1 表示无效/未知）。
         */
        return {
            maxHp: -1,
            hp: -1,
            maxMp: -1,
            mp: -1,
            hit: -1,
            def: -1,
            eva: -1,
            blk: -1
        };
    }

    function ensureStatsState() {
        /**
         * 参数：无
         * 返回：object|null，典型值 { byUid: { '000000': {...} } }
         * 操作：确保 $gameSystem 上存在数值存档字段，并返回它。
         */
        if (!$gameSystem) return null;
        if (!$gameSystem._chaosCharacterStats) {
            $gameSystem._chaosCharacterStats = { byUid: {} };
        }
        if (!$gameSystem._chaosCharacterStats.byUid) {
            $gameSystem._chaosCharacterStats.byUid = {};
        }
        return $gameSystem._chaosCharacterStats;
    }

    function ensureStatsForUid(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：object|null，典型值 {maxHp:-1, hp:-1, ...}
         * 操作：
         * - 若存档中不存在该 UID 的数值，则创建一份；
         * - 创建时会尽量从 Chaos.Characters.get(uid) 中读取同名字段作为初始值，否则用 -1 模板。
         */
        var state = ensureStatsState();
        if (!state) return null;
        var key = String(uid);
        if (!state.byUid[key]) {
            var tpl = defaultStatsTemplate();
            var profile = Chaos && Chaos.Characters && Chaos.Characters.get ? Chaos.Characters.get(key) : null;
            if (profile) {
                tpl.maxHp = toInt32(profile.maxHp, tpl.maxHp);
                tpl.hp = toInt32(profile.hp, tpl.hp);
                tpl.maxMp = toInt32(profile.maxMp, tpl.maxMp);
                tpl.mp = toInt32(profile.mp, tpl.mp);
                tpl.hit = toFloat(profile.hit, tpl.hit);
                tpl.def = toFloat(profile.def, tpl.def);
                tpl.eva = toFloat(profile.eva, tpl.eva);
                tpl.blk = toFloat(profile.blk, tpl.blk);
            }
            state.byUid[key] = tpl;
        }
        return state.byUid[key];
    }

    function setStats(uid, patch) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * - patch: object，典型值 {hit:3, def:4}
         * 返回：object|null，返回更新后的 stats 对象
         * 操作：对指定角色 UID 的数值进行“局部更新”。未提供的字段不变；提供的字段按字段类型写入：
         * - maxHp/hp/maxMp/mp：int32
         * - hit/def/eva/blk：float（负数仍表示无效）
         */
        var stats = ensureStatsForUid(uid);
        if (!stats) return null;
        if (!patch) return stats;

        if (patch.maxHp !== undefined) stats.maxHp = toInt32(patch.maxHp, stats.maxHp);
        if (patch.hp !== undefined) stats.hp = toInt32(patch.hp, stats.hp);
        if (patch.maxMp !== undefined) stats.maxMp = toInt32(patch.maxMp, stats.maxMp);
        if (patch.mp !== undefined) stats.mp = toInt32(patch.mp, stats.mp);
        if (patch.hit !== undefined) stats.hit = toFloat(patch.hit, stats.hit);
        if (patch.def !== undefined) stats.def = toFloat(patch.def, stats.def);
        if (patch.eva !== undefined) stats.eva = toFloat(patch.eva, stats.eva);
        if (patch.blk !== undefined) stats.blk = toFloat(patch.blk, stats.blk);
        return stats;
    }

    function getStats(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：object|null，典型值 {maxHp:-1, hp:-1, ...}
         * 操作：获取指定 UID 的数值对象（若不存在会自动创建默认值）。
         */
        return ensureStatsForUid(uid);
    }

    Chaos.CharacterStats = Chaos.CharacterStats || {
        get: getStats,
        set: setStats
    };

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：在新档初始化时创建数值存档字段容器。
         */
        _Game_System_initialize.call(this);
        ensureStatsState();
    };
})();
