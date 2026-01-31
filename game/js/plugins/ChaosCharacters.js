/*:
 * @plugindesc Chaos Characters Registry
 * @author
 *
 * @help
 * No plugin commands.
 */

(function() {
    'use strict';

    var root = (function() { return this || (0, eval)('this'); })();
    var Chaos = root.Chaos = root.Chaos || {};

    function ChaosCharacterRegistry() {
        this._byUid = {};
    }

    ChaosCharacterRegistry.prototype.register = function(character) {
        if (!character || !character.uid) return;
        this._byUid[String(character.uid)] = character;
    };

    ChaosCharacterRegistry.prototype.get = function(uid) {
        return this._byUid[String(uid)] || null;
    };

    ChaosCharacterRegistry.prototype.has = function(uid) {
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
            description: ''
        });
    }
})();

