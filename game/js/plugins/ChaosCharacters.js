/*:
 * @plugindesc Chaos Characters Registry
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：角色注册表插件入口。提供全局 Chaos.Characters，用 UID 索引角色基础数据。
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

    function ChaosCharacterRegistry() {
        /**
         * 参数：无
         * 返回：void
         * 操作：创建角色注册表实例。内部以 _byUid 维护“UID -> 角色数据”的映射。
         */
        this._byUid = {};
    }

    ChaosCharacterRegistry.prototype.register = function(character) {
        /**
         * 参数：
         * - character: object，典型值 {uid:'000000', publicName:'???', realName:'ABC', ...}
         * 返回：void
         * 操作：注册/覆盖一个角色数据到注册表中（以 character.uid 为唯一键）。
         */
        if (!character || !character.uid) return;
        this._byUid[String(character.uid)] = character;
    };

    ChaosCharacterRegistry.prototype.get = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：object|null，命中返回角色对象，否则返回 null
         * 操作：按 UID 获取角色数据。
         */
        return this._byUid[String(uid)] || null;
    };

    ChaosCharacterRegistry.prototype.has = function(uid) {
        /**
         * 参数：
         * - uid: string|number，典型值 '000000'
         * 返回：boolean，典型值 true/false
         * 操作：判断指定 UID 的角色是否已注册。
         */
        return !!this._byUid[String(uid)];
    };

    Chaos.Characters = Chaos.Characters || new ChaosCharacterRegistry();

    if (!Chaos.Characters.has('000000')) {
        Chaos.Characters.register({
            uid: '000000',
            code: 'protagonist',
            publicName: '???',
            realName: 'ABC',
            faction: '',
            factionRank: '',
            description: '',
            maxHp: -1,
            hp: -1,
            maxMp: -1,
            mp: -1,
            hit: -1,
            def: -1,
            eva: -1,
            blk: -1
        });
    }
})();
