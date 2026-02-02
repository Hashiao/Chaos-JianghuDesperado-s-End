/*:
 * @plugindesc Chaos Debug Console (separate window logger)
 * @author
 *
 * @help
 * 提供独立于游戏窗口的日志控制台（NW.js 新窗口）。
 *
 * 快捷键：
 * - F10：打开/关闭调试控制台
 *
 * API：
 * - Chaos.DebugConsole.open()
 * - Chaos.DebugConsole.close()
 * - Chaos.DebugConsole.toggle()
 * - Chaos.DebugConsole.log(...args)
 * - Chaos.DebugConsole.warn(...args)
 * - Chaos.DebugConsole.error(...args)
 */
 
(function() {
    'use strict';
 
    var root = (function() { return this || (0, eval)('this'); })();
    var Chaos = root.Chaos = root.Chaos || {};
 
    var MAX_BUFFER = 2000;
    var buffer = [];
 
    function nowStamp() {
        var d = new Date();
        var p2 = function(n) { return (n < 10 ? '0' : '') + n; };
        return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    }
 
    function safeToString(v) {
        if (v === null) return 'null';
        if (v === undefined) return 'undefined';
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        try { return JSON.stringify(v); } catch (e) {}
        try { return String(v); } catch (e2) {}
        return '[Unprintable]';
    }
 
    function formatLine(level, args) {
        var parts = [];
        for (var i = 0; i < args.length; i++) parts.push(safeToString(args[i]));
        return '[' + nowStamp() + '][' + level + '] ' + parts.join(' ');
    }
 
    function pushLine(line) {
        buffer.push(line);
        if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    }
 
    var state = {
        win: null,
        openedOnce: false
    };
 
    function hasNw() {
        return typeof root.nw !== 'undefined' && root.nw && root.nw.Window && root.nw.Window.open;
    }
 
    function writeToWindow(lines) {
        var w = state.win;
        if (!w || w.closed) return false;
        try {
            var doc = w.window && w.window.document ? w.window.document : null;
            if (!doc) return false;
            var pre = doc.getElementById('chaos-log');
            if (!pre) return false;
            pre.textContent = lines.join('\n');
            w.window.scrollTo(0, doc.body.scrollHeight);
            return true;
        } catch (e) {
            return false;
        }
    }
 
    function ensureWindow(cb) {
        if (!hasNw()) return cb ? cb(false) : false;
        if (state.win && !state.win.closed) return cb ? cb(true) : true;
 
        var options = {
            title: 'Chaos Debug Console',
            width: 900,
            height: 600,
            focus: false,
            resizable: true,
            always_on_top: true
        };
 
        root.nw.Window.open('about:blank', options, function(w) {
            state.win = w;
            state.openedOnce = true;
            try {
                w.on('closed', function() { state.win = null; });
            } catch (e) {}
            try {
                var doc = w.window.document;
                doc.open();
                doc.write('<!doctype html><html><head><meta charset=\"utf-8\" />' +
                    '<title>Chaos Debug Console</title>' +
                    '<style>' +
                    'body{margin:0;background:#0b0f14;color:#d6dde6;font-family:Consolas,monospace;}' +
                    '#bar{position:sticky;top:0;background:#101826;border-bottom:1px solid #223;display:flex;gap:8px;padding:8px;align-items:center;}' +
                    'button{background:#1b2b44;border:1px solid #2b3a55;color:#d6dde6;padding:6px 10px;cursor:pointer;}' +
                    'button:hover{background:#243a5c;}' +
                    '#chaos-log{white-space:pre-wrap;word-break:break-word;padding:10px;}' +
                    '</style></head><body>' +
                    '<div id=\"bar\">' +
                    '<button id=\"btn-clear\">Clear</button>' +
                    '<button id=\"btn-copy\">Copy</button>' +
                    '<span style=\"opacity:.75\">F10 to toggle</span>' +
                    '</div>' +
                    '<pre id=\"chaos-log\"></pre>' +
                    '<script>' +
                    'document.getElementById(\"btn-clear\").onclick=function(){document.getElementById(\"chaos-log\").textContent=\"\";};' +
                    'document.getElementById(\"btn-copy\").onclick=function(){' +
                    'var t=document.getElementById(\"chaos-log\").textContent||\"\";' +
                    'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);}else{' +
                    'var ta=document.createElement(\"textarea\");ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand(\"copy\");document.body.removeChild(ta);}' +
                    '};' +
                    '</script>' +
                    '</body></html>');
                doc.close();
            } catch (e2) {}
            writeToWindow(buffer);
            if (cb) cb(true);
        });
        return true;
    }
 
    function open() {
        ensureWindow();
    }
 
    function close() {
        var w = state.win;
        if (!w || w.closed) return;
        try { w.close(true); } catch (e) {}
        state.win = null;
    }
 
    function toggle() {
        var w = state.win;
        if (w && !w.closed) {
            close();
        } else {
            open();
        }
    }
 
    function emit(level, args) {
        var line = formatLine(level, args);
        pushLine(line);
        try {
            if (level === 'ERROR') console.error.apply(console, args);
            else if (level === 'WARN') console.warn.apply(console, args);
            else console.log.apply(console, args);
        } catch (e) {}
        writeToWindow(buffer);
    }
 
    Chaos.DebugConsole = Chaos.DebugConsole || {};
    Chaos.DebugConsole.open = open;
    Chaos.DebugConsole.close = close;
    Chaos.DebugConsole.toggle = toggle;
    Chaos.DebugConsole.log = function() { emit('LOG', arguments); };
    Chaos.DebugConsole.warn = function() { emit('WARN', arguments); };
    Chaos.DebugConsole.error = function() { emit('ERROR', arguments); };
 
    if (root.Input && root.Input.keyMapper) {
        root.Input.keyMapper[121] = 'chaosDebugConsole';
    }
 
    if (root.Scene_Base) {
        var _Scene_Base_update = Scene_Base.prototype.update;
        Scene_Base.prototype.update = function() {
            _Scene_Base_update.call(this);
            if (root.Input && root.Input.isTriggered && root.Input.isTriggered('chaosDebugConsole')) {
                toggle();
            }
        };
    }
})();

