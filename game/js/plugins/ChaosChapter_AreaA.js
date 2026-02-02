/*:
 * @plugindesc Chaos Chapter - Area A (A1~A4 Sample)
 * @author
 *
 * @help
 * 本插件只负责注册“A区（A1~A4）”的对话脚本数据。
 * 入口由地图事件触发（见 Map001 的事件：A1营地/尸堆/棚屋 等）。
 */
 
(function() {
    /**
     * 参数：无
     * 返回：void
     * 操作：A区对话脚本注册入口。
     * 说明：
     * - 对话ID：AREA_A
     * - 当前阶段：先做“样板章”，把A1遭遇链落地为可玩事件；后续再逐步补全文字与战斗/检定。
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
    if (!Chaos.Dialogues || !Chaos.Dialogues.register) return;
 
    Chaos.Dialogues.register({
        id: 'AREA_A',
        title: 'A区',
        description: 'A区（A1~A4）样板章节：先落地A1遭遇链',
        defaultSpeakerUid: '000000',
        nodes: {
            A1_ENCOUNTER: {
                title: 'A1遭遇-营地',
                speakerUid: '000000',
                description: '营地概览（篝火/尸堆/棚屋），提供三个互动入口',
                lines: [
                    '你来到一片空地，中间燃着一小堆篝火。',
                    '火光摇曳，照出地上几团浓黑的影子——像堆着什么，又看不太清。',
                    '火旁还搭着两间木棚屋，四下一片寂静，只有柴火偶尔噼啪作响。',
                    '',
                    '【查看尸堆】  【查看棚屋】  【离开】'
                ],
                links: {
                    '查看尸堆': 'A1_CORPSE',
                    '查看棚屋': 'A1_SHACK',
                    '离开': 'A1_LEAVE'
                }
            },
            A1_CORPSE: {
                title: 'A1遭遇-尸堆',
                speakerUid: '000000',
                description: '查看尸堆（后续会扩展为搜尸/救治分支）',
                lines: [
                    '你蹲下身逐一扒开那堆冰凉的躯体。',
                    '手指陷进沾满血污与尘泥的粗布衣裳里，触感沉重而僵硬。',
                    '',
                    '（这里后续会接入：搜尸、发现采药人、疗伤/内力救治等分支）',
                    '【返回】'
                ],
                links: { '返回': 'A1_ENCOUNTER' }
            },
            A1_SHACK: {
                title: 'A1遭遇-棚屋',
                speakerUid: '000000',
                description: '查看棚屋（后续会扩展为搜索/发现道具/触发战斗）',
                lines: [
                    '你走近棚屋，浓重的草药与腐败气味混在一起，直冲鼻腔。',
                    '',
                    '（这里后续会接入：搜索棚屋、发现物品、触发进一步遭遇）',
                    '【返回】'
                ],
                links: { '返回': 'A1_ENCOUNTER' }
            },
            A1_LEAVE: {
                title: 'A1遭遇-离开',
                speakerUid: '000000',
                description: '暂时离开该处（后续会切到其它区域出口）',
                lines: [
                    '你没有在这里久留的打算。',
                    '白雾压得人喘不过气，你必须尽快搞清自己身处何处。',
                    '',
                    '【结束】'
                ],
                links: { '结束': '__END__' }
            }
        }
    });
})();
