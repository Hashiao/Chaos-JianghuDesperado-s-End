/*:
 * @plugindesc Chaos UID Bridge (UID ↔ RPG Maker Actor)
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：桥接器插件入口。以“自定义 UID”为核心，把三类东西串起来：
     * 1) 角色档案（ChaosCharacters，UID->publicName/realName/actorId 等）
     * 2) 角色动态数值（ChaosCharacterStats，UID->maxHp/hp/.../hit/def/eva/blk）
     * 3) RPG Maker MV 自带 Actor（$gameActors.actor(actorId)）
     *
     * 重要边界（按你当前设定）：
     * - hit/def/eva/blk 目前只是剧情/显示值，不参与 MV 战斗系统，不覆盖 Game_Actor 的原生 hit/eva/cnt/def。
     * - blk 与 actor.cnt 完全不同，桥接器不做映射。
     *
     * 你要新增“关键角色（两边都有记录）”时应该怎么做（简明步骤）：
     * A) 在 RPG Maker 数据库 Actors 里新增一个 Actor，得到 actorId（例如 12）。
     * B) 在 ChaosCharacters 里新增一条角色档案，至少填：
     *    - uid：例如 '000012'
     *    - actorId：12
     *    - publicName / realName：按策划填写（显示名字以这里为准）
     *    - 其他字段（势力、描述等）可空
     * C) 初始数值（两种方式任选其一）：
     *    - 方式1（推荐，清晰）：用 ChaosCharacterStats/对话 action 写入初始值；未知填 -1。
     *    - 方式2（兜底）：让 maxHp/hp/maxMp/mp/def 等保持 -1，桥接器在第一次访问时会从 Actor 读取填入（hit/eva/blk 默认不从 Actor 初始化）。
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
         * - value: any，典型值 1 / "1" / null
         * - fallback: number，典型值 -1
         * 返回：number，32位整数；若无法转换则返回 fallback
         * 操作：把输入安全转换为 32 位整数。用于 actorId 等整数索引字段。
         */
        var n = Number(value);
        if (!isFinite(n)) return fallback;
        return n | 0;
    }

    function isValidNumber(value) {
        /**
         * 参数：
         * - value: any，典型值 3 / 0.2 / -1 / null
         * 返回：boolean，典型值 true/false
         * 操作：判断该值是否为“有效数值”（Number 且 >= 0）。负数代表无效值。
         */
        var n = Number(value);
        if (!isFinite(n)) return false;
        return n >= 0;
    }

    function ensureNameMode() {
        /**
         * 参数：无
         * 返回：string，典型值 'public' 或 'real'
         * 操作：确保存档字段 $gameSystem._chaosNameMode 存在并返回它。
         * 约定：
         * - 'public'：显示 publicName
         * - 'real'：显示 realName
         */
        if (!$gameSystem) return 'public';
        if (!$gameSystem._chaosNameMode) $gameSystem._chaosNameMode = 'public';
        return String($gameSystem._chaosNameMode);
    }

    function ChaosUidBridge() {
        /**
         * 参数：无
         * 返回：void
         * 操作：桥接器对象。内部缓存两张表：
         * - _uidToActorId：uid -> actorId
         * - _actorIdToUid：actorId -> uid
         */
        this._uidToActorId = {};
        this._actorIdToUid = {};
        this._cacheReady = false;
    }

    ChaosUidBridge.prototype._resetCache = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：清空桥接缓存，强制下次重新扫描角色档案表。
         */
        this._uidToActorId = {};
        this._actorIdToUid = {};
        this._cacheReady = false;
    };

    ChaosUidBridge.prototype._ensureCache = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：从 Chaos.Characters 里扫描所有角色档案，构建 UID↔actorId 映射缓存。
         * 说明：
         * - 当前 ChaosCharacters 注册表未提供“遍历接口”，所以这里直接读取其内部字段 _byUid。\n+         * - 这是刻意的“简单做法”，便于你理解；后续若你希望更严格封装，可给 ChaosCharacters 增加 all() 方法再改这里。
         */
        if (this._cacheReady) return;
        this._uidToActorId = {};
        this._actorIdToUid = {};

        var registry = Chaos && Chaos.Characters ? Chaos.Characters : null;
        var dict = registry && registry._byUid ? registry._byUid : null;
        if (dict) {
            for (var uid in dict) {
                if (!Object.prototype.hasOwnProperty.call(dict, uid)) continue;
                var profile = dict[uid];
                if (!profile) continue;
                var actorId = toInt32(profile.actorId, -1);
                if (actorId > 0) {
                    this._uidToActorId[String(uid)] = actorId;
                    this._actorIdToUid[String(actorId)] = String(uid);
                }
            }
        }

        this._cacheReady = true;
    };

    ChaosUidBridge.prototype.getProfile = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：object|null，命中返回角色档案对象，否则返回 null
         * 操作：按 UID 获取自定义角色档案（ChaosCharacters）。
         */
        if (!Chaos || !Chaos.Characters || !Chaos.Characters.get) return null;
        return Chaos.Characters.get(String(uid));
    };

    ChaosUidBridge.prototype.getActorIdByUid = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：number，典型值 1；若没有映射则返回 -1
         * 操作：用 UID 查 actorId（来自角色档案 actorId 字段）。
         */
        this._ensureCache();
        var key = String(uid);
        if (!this._uidToActorId[key]) return -1;
        return toInt32(this._uidToActorId[key], -1);
    };

    ChaosUidBridge.prototype.getUidByActorId = function(actorId) {
        /**
         * 参数：
         * - actorId: number|string，典型值 1
         * 返回：string|null，典型值 '000000'；无映射返回 null
         * 操作：用 actorId 反查 UID。
         */
        this._ensureCache();
        var key = String(toInt32(actorId, -1));
        if (!this._actorIdToUid[key]) return null;
        return String(this._actorIdToUid[key]);
    };

    ChaosUidBridge.prototype.getActorByUid = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：Game_Actor|null
         * 操作：用 UID 找到对应的 RPG Maker Actor 对象（$gameActors.actor(actorId)）。
         */
        var actorId = this.getActorIdByUid(uid);
        if (actorId <= 0) return null;
        if (!$gameActors || !$gameActors.actor) return null;
        return $gameActors.actor(actorId);
    };

    ChaosUidBridge.prototype.getDisplayName = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：string，典型值 '???'
         * 操作：返回用于 UI 显示的名字。\n+         * 规则：若发生冲突，一律以自定义角色档案为准；显示 publicName 或 realName 由存档字段控制。
         */
        var profile = this.getProfile(uid);
        if (!profile) return '???';

        var mode = ensureNameMode();
        if (mode === 'real') {
            if (profile.realName && String(profile.realName).length > 0) return String(profile.realName);
        }
        if (profile.publicName && String(profile.publicName).length > 0) return String(profile.publicName);
        return '???';
    };

    ChaosUidBridge.prototype.getStats = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：object|null，典型值 {maxHp:-1, hp:-1, ...}
         * 操作：获取自定义“动态数值”对象（存档中）。\n+         * 注意：hit/def/eva/blk 目前只用于剧情/显示，不会影响 MV 战斗。
         */
        if (!Chaos || !Chaos.CharacterStats || !Chaos.CharacterStats.get) return null;
        return Chaos.CharacterStats.get(String(uid));
    };

    ChaosUidBridge.prototype.setStats = function(uid, patch) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * - patch: object，典型值 {hit:3.0, def:4.0}
         * 返回：object|null，返回更新后的 stats 对象
         * 操作：对指定 UID 的自定义动态数值做局部更新（写入存档）。\n+         * 说明：负数仍表示“无效/未知”。
         */
        if (!Chaos || !Chaos.CharacterStats || !Chaos.CharacterStats.set) return null;
        return Chaos.CharacterStats.set(String(uid), patch);
    };

    ChaosUidBridge.prototype.initStatsFromActorIfInvalid = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：void
         * 操作：当自定义数值为“无效值（负数）”时，从 Actor 兜底初始化部分字段。\n+         * 初始化范围（保守做法）：maxHp/hp/maxMp/mp/def。\n+         * 不初始化 hit/eva/blk：因为它们当前只用于剧情/显示，且与 MV 战斗语义不绑定，避免误把概率写成点数。
         */
        var actor = this.getActorByUid(uid);
        if (!actor) return;
        var stats = this.getStats(uid);
        if (!stats) return;

        var patch = {};
        var changed = false;

        if (!isValidNumber(stats.maxHp)) { patch.maxHp = actor.mhp; changed = true; }
        if (!isValidNumber(stats.hp)) { patch.hp = actor.hp; changed = true; }
        if (!isValidNumber(stats.maxMp)) { patch.maxMp = actor.mmp; changed = true; }
        if (!isValidNumber(stats.mp)) { patch.mp = actor.mp; changed = true; }
        if (!isValidNumber(stats.def)) { patch.def = Number(actor.def); changed = true; }

        if (changed) this.setStats(uid, patch);
    };

    Chaos.UidBridge = Chaos.UidBridge || new ChaosUidBridge();

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        /**
         * 参数：无
         * 返回：void
         * 操作：初始化桥接器相关的存档字段：\n+         * - _chaosNameMode：显示名字模式（public/real），默认 public。\n+         * 同时清空桥接器缓存，避免新档/读档后缓存与数据不一致。
         */
        _Game_System_initialize.call(this);
        ensureNameMode();
        if (Chaos && Chaos.UidBridge && Chaos.UidBridge._resetCache) {
            Chaos.UidBridge._resetCache();
        }
    };
})();

