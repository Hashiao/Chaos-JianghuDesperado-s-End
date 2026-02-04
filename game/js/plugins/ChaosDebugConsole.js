/*:
 * @plugindesc Chaos Debug Console (separate window + file logger)
 * @author
 *
 * @help
 * 如何写日志（给脚本/插件编写者）：
 * - Chaos.Log.debug('内容', 任意对象...)
 * - Chaos.Log.info('内容', 任意对象...)
 * - Chaos.Log.warning('内容', 任意对象...)
 * - Chaos.Log.error('内容', 任意对象...)
 *
 * 功能：
 * - F10 打开/关闭独立日志窗口（不占用游戏消息框）
 * - 每次启动自动创建日志文件：./log/log_YYYYMMDD_HHMMSS.log
 * - 每条日志包含：等级、时间戳、来源文件与行号（尽力解析调用栈）
 *
 * 说明：
 * - “单独线程”在 MV/NW.js 的 JS 环境里无法做到真正的多线程隔离；
 *   本插件尽量做到“高独立”：
 *   1) 独立 NW 窗口显示日志；
 *   2) 文件写入使用队列异步刷盘，尽量不阻塞主循环。
 *
 * 快捷键：
 * - F10：打开/关闭调试控制台
 *
 * API：
 * - Chaos.DebugConsole.open()/close()/toggle()
 * - Chaos.Log.debug/info/warning/error(...)
 * - 兼容旧接口：Chaos.DebugConsole.log/warn/error(...)（分别映射到 info/warning/error）
 */
 
(function() {
    'use strict';
 
    var root = (function() { return this || (0, eval)('this'); })();
    var Chaos = root.Chaos = root.Chaos || {};
 
    var LEVELS = {
        debug: { name: 'debug', color: '#6b6b6b' },
        info: { name: 'info', color: '#111111' },
        warning: { name: 'warning', color: '#b8860b' },
        error: { name: 'error', color: '#b00020' }
    };
 
    var MAX_BUFFER = 3000;
    var entries = [];
    var queue = [];
    var logStream = null;
    var logFilePath = '';
 
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function pad3(n) {
        if (n < 10) return '00' + n;
        if (n < 100) return '0' + n;
        return String(n);
    }
 
    function nowStamp() {
        var d = new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
            pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + '.' + pad3(d.getMilliseconds());
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
 
    var RE_STACK_FILE_URL = new RegExp('(file:///.*?\\.js):(\\d+):(\\d+)', 'i');
    var RE_STACK_WIN_PATH = new RegExp('([A-Za-z]:\\\\.*?\\.js):(\\d+):(\\d+)', 'i');
 
    function parseCaller() {
        var stack = '';
        try { stack = (new Error()).stack || ''; } catch (e) {}
        if (!stack) return { file: '', line: '', col: '' };
        var lines = stack.split('\n');
        for (var i = 2; i < lines.length; i++) {
            var s = String(lines[i] || '').trim();
            if (!s) continue;
            if (s.indexOf('ChaosDebugConsole') >= 0) continue;
            if (s.indexOf('Chaos.Log') >= 0) continue;
            if (s.indexOf('Chaos.DebugConsole') >= 0) continue;
            var m = s.match(RE_STACK_FILE_URL) || s.match(RE_STACK_WIN_PATH);
            if (m) {
                var filePath = m[1];
                var fileName = filePath.split('/').pop().split('\\\\').pop();
                return { file: fileName, line: m[2], col: m[3] };
            }
        }
        return { file: '', line: '', col: '' };
    }
 
    function formatLine(level, args, caller) {
        var parts = [];
        for (var i = 0; i < args.length; i++) parts.push(safeToString(args[i]));
        var loc = '';
        if (caller && caller.file) loc = '[' + caller.file + ':' + caller.line + '] ';
        return '[' + nowStamp() + '][' + level + '] ' + loc + parts.join(' ');
    }
 
    function pushEntry(level, line) {
        entries.push({ level: String(level || 'info').toLowerCase(), text: line });
        if (entries.length > MAX_BUFFER) entries.splice(0, entries.length - MAX_BUFFER);
    }
 
    function hasNodeFs() {
        try { return !!root.require; } catch (e) { return false; }
    }
 
    function tryRequire(id) {
        try { return root.require ? root.require(id) : null; } catch (e) { return null; }
    }
 
    function mkdirp(fs, path, dir) {
        if (!dir) return;
        try {
            if (fs.existsSync(dir)) return;
        } catch (e) {}
        try {
            if (fs.mkdirSync && typeof fs.mkdirSync === 'function') {
                fs.mkdirSync(dir, { recursive: true });
                return;
            }
        } catch (e0) {}
        var parent = null;
        try { parent = path.dirname(dir); } catch (e2) {}
        if (parent && parent !== dir) mkdirp(fs, path, parent);
        try { fs.mkdirSync(dir); } catch (e3) {}
    }
 
    function resolveLogDir() {
        var fs = tryRequire('fs');
        var path = tryRequire('path');
        if (!fs || !path) return '';
        var base = '';
        try {
            base = process && process.cwd ? process.cwd() : '';
        } catch (e) {
            base = '';
        }
        if (!base) {
            try {
                if (root.nw && root.nw.App && root.nw.App.startPath) base = root.nw.App.startPath;
            } catch (e1) {}
        }
        if (!base) {
            try {
                var p = decodeURIComponent(root.location && root.location.pathname ? root.location.pathname : '');
                if (p) base = path.dirname(p);
            } catch (e2) {}
        }
        if (base) {
            return path.join(base, 'log');
        }
        return '';
    }
 
    function createLogStreamIfPossible() {
        if (!hasNodeFs()) return;
        var fs = tryRequire('fs');
        var path = tryRequire('path');
        if (!fs || !path) return;
 
        var dir = resolveLogDir();
        if (!dir) return;
        mkdirp(fs, path, dir);
 
        var d = new Date();
        var fileName = 'log_' +
            d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' +
            pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.log';
        logFilePath = path.join(dir, fileName);
        try {
            logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
        } catch (e) {
            logStream = null;
        }
    }
 
    function flushQueue() {
        if (!queue || queue.length === 0) return;
        if (!logStream || !logStream.write) {
            queue.length = 0;
            return;
        }
        var batch = queue.splice(0, Math.min(queue.length, 200));
        for (var i = 0; i < batch.length; i++) {
            try { logStream.write(batch[i] + '\n'); } catch (e) {}
        }
    }
 
    var state = {
        win: null,
        browserWin: null,
        openedOnce: false
    };
 
    function hasNw() {
        return typeof root.nw !== 'undefined' && root.nw && root.nw.Window && root.nw.Window.open;
    }
 
    function getLogWindow() {
        if (state.win && !state.win.closed && state.win.window) return state.win.window;
        if (state.browserWin && !state.browserWin.closed) return state.browserWin;
        return null;
    }
 
    function writeToWindow(list) {
        var w = getLogWindow();
        if (!w || w.closed) return false;
        try {
            var doc = w.document || null;
            if (!doc) return false;
            var box = doc.getElementById('chaos-log');
            if (!box) return false;
            box.innerHTML = '';
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                var div = doc.createElement('div');
                div.className = 'line ' + (e && e.level ? e.level : 'info');
                div.textContent = e && e.text ? e.text : String(e);
                box.appendChild(div);
            }
            w.scrollTo(0, doc.body.scrollHeight || 0);
            return true;
        } catch (e) {
            return false;
        }
    }
 
    function buildConsoleHtml() {
        return '<!doctype html><html><head><meta charset=\"utf-8\" />' +
            '<title>Chaos Debug Console</title>' +
            '<style>' +
            'body{margin:0;background:#f2f8f2;color:#111;font-family:Consolas,monospace;}' +
            '#bar{position:sticky;top:0;background:#e9f3e9;border-bottom:1px solid #cfe2cf;display:flex;gap:8px;padding:8px;align-items:center;}' +
            'button{background:#ffffff;border:1px solid #c9d9c9;color:#111;padding:6px 10px;cursor:pointer;}' +
            'button:hover{background:#f7fbf7;}' +
            '#meta{margin-left:auto;opacity:.75;font-size:12px;}' +
            '#chaos-log{padding:10px;}' +
            '.line{white-space:pre-wrap;word-break:break-word;line-height:1.35;}' +
            '.debug{color:' + LEVELS.debug.color + ';}' +
            '.info{color:' + LEVELS.info.color + ';}' +
            '.warning{color:' + LEVELS.warning.color + ';}' +
            '.error{color:' + LEVELS.error.color + ';}' +
            '</style></head><body>' +
            '<div id=\"bar\">' +
            '<button id=\"btn-clear\">清空</button>' +
            '<button id=\"btn-copy\">复制</button>' +
            '<span id=\"meta\"></span>' +
            '</div>' +
            '<div id=\"chaos-log\"></div>' +
            '<script>' +
            'window.__CHAOS_LOGS__=[];' +
            'function render(all){' +
            'var box=document.getElementById(\"chaos-log\");box.innerHTML=\"\";' +
            'for(var i=0;i<all.length;i++){var e=all[i];var d=document.createElement(\"div\");d.className=\"line \"+(e.level||\"info\");d.textContent=e.text;box.appendChild(d);} window.scrollTo(0,document.body.scrollHeight);' +
            '}' +
            'document.getElementById(\"btn-clear\").onclick=function(){window.__CHAOS_LOGS__=[];render(window.__CHAOS_LOGS__);};' +
            'document.getElementById(\"btn-copy\").onclick=function(){var t=window.__CHAOS_LOGS__.map(function(x){return x.text;}).join(\"\\n\");' +
            'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);}else{var ta=document.createElement(\"textarea\");ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand(\"copy\");document.body.removeChild(ta);}' +
            '};' +
            'window.addEventListener(\"message\",function(ev){var m=ev.data||null; if(!m||m.__chaosLog!==true) return;' +
            'if(m.type===\"meta\"){var meta=document.getElementById(\"meta\"); if(meta) meta.textContent=m.text||\"\"; return;}' +
            'if(m.type===\"batch\"){for(var i=0;i<m.items.length;i++) window.__CHAOS_LOGS__.push(m.items[i]);}' +
            'else if(m.type===\"one\"){window.__CHAOS_LOGS__.push(m.item);} render(window.__CHAOS_LOGS__);' +
            '});' +
            '</script>' +
            '</body></html>';
    }
 
    function ensureWindow(cb) {
        if ((state.win && !state.win.closed) || (state.browserWin && !state.browserWin.closed)) return cb ? cb(true) : true;
 
        var options = {
            title: 'Chaos Debug Console',
            width: 900,
            height: 600,
            focus: true,
            resizable: true,
            always_on_top: true,
            show: true
        };
 
        var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(buildConsoleHtml());
        if (hasNw()) {
            try {
                root.nw.Window.open(url, options, function(w) {
                    state.win = w;
                    state.browserWin = null;
                    state.openedOnce = true;
                    try {
                        w.on('closed', function() { state.win = null; });
                    } catch (e) {}
                    try {
                        if (w.show) w.show(true);
                        if (w.focus) w.focus();
                    } catch (e4) {}
                    try {
                        w.on('loaded', function() {
                            sendMetaToWindow();
                            sendBatchToWindow();
                        });
                    } catch (e3) {
                        sendMetaToWindow();
                        try { setTimeout(function() { sendBatchToWindow(); }, 50); } catch (e6) { sendBatchToWindow(); }
                    }
                    if (cb) cb(true);
                });
                return true;
            } catch (e5) {
            }
        }
 
        try {
            var bw = root.open(url, 'ChaosDebugConsole', 'width=900,height=600,resizable=yes,scrollbars=yes');
            if (bw) {
                state.browserWin = bw;
                state.win = null;
                state.openedOnce = true;
                sendMetaToWindow();
                try { setTimeout(function() { sendBatchToWindow(); }, 200); } catch (e6) { sendBatchToWindow(); }
                if (cb) cb(true);
                return true;
            }
        } catch (e7) {
        }
        return cb ? cb(false) : false;
    }
 
    function open() {
        ensureWindow();
    }
 
    function close() {
        if (state.win && !state.win.closed) {
            try { state.win.close(true); } catch (e) {}
        }
        if (state.browserWin && !state.browserWin.closed) {
            try { state.browserWin.close(); } catch (e2) {}
        }
        state.win = null;
        state.browserWin = null;
    }
 
    function toggle() {
        var w = getLogWindow();
        if (w && !w.closed) {
            close();
        } else {
            open();
        }
    }
 
    function sendBatchToWindow() {
        var w = getLogWindow();
        if (!w || w.closed) return;
        try {
            var items = entries.slice(0);
            w.postMessage({ __chaosLog: true, type: 'batch', items: items }, '*');
        } catch (e) {}
        writeToWindow(entries);
    }
 
    function sendOneToWindow(level, text) {
        var w = getLogWindow();
        if (!w || w.closed) return;
        try {
            w.postMessage({ __chaosLog: true, type: 'one', item: { level: level, text: text } }, '*');
        } catch (e) {}
    }
 
    function sendMetaToWindow() {
        var w = getLogWindow();
        if (!w || w.closed) return;
        try {
            w.postMessage({ __chaosLog: true, type: 'meta', text: 'F10 开关 | 文件: ' + (logFilePath || '(未启用文件日志)') }, '*');
        } catch (e) {}
    }
 
    function emit(level, args) {
        var caller = parseCaller();
        var line = formatLine(level, args, caller);
        pushEntry(level, line);
        queue.push(line);
        sendOneToWindow(String(level).toLowerCase(), line);
        writeToWindow(entries);
    }
 
    Chaos.DebugConsole = Chaos.DebugConsole || {};
    Chaos.DebugConsole.open = open;
    Chaos.DebugConsole.close = close;
    Chaos.DebugConsole.toggle = toggle;
    Chaos.DebugConsole.log = function() { emit('info', arguments); };
    Chaos.DebugConsole.warn = function() { emit('warning', arguments); };
    Chaos.DebugConsole.error = function() { emit('error', arguments); };
 
    Chaos.Log = Chaos.Log || {};
    Chaos.Log.debug = function() { emit('debug', arguments); };
    Chaos.Log.info = function() { emit('info', arguments); };
    Chaos.Log.warning = function() { emit('warning', arguments); };
    Chaos.Log.error = function() { emit('error', arguments); };
 
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
 
    try {
        var doc2 = root.document;
        if (doc2 && doc2.addEventListener) {
            doc2.addEventListener('keydown', function(ev) {
                var e = ev || root.event;
                var code = e && (e.keyCode || e.which);
                var key = e && e.key;
                if (code === 121 || key === 'F10') {
                    try { if (e && e.preventDefault) e.preventDefault(); } catch (e1) {}
                    toggle();
                }
            }, true);
        }
    } catch (e5) {}
 
    createLogStreamIfPossible();
    try { setInterval(flushQueue, 200); } catch (e) {}
    emit('info', ['Logger ready', logFilePath || '(no file log)']);
    emit('debug', ['Logger test: debug', { ok: true }]);
    emit('info', ['Logger test: info']);
    emit('warning', ['Logger test: warning']);
    emit('error', ['Logger test: error']);
 
    try {
        root.addEventListener('error', function(ev) {
            Chaos.Log.error('window.onerror', ev && ev.message, ev && ev.filename, ev && ev.lineno, ev && ev.colno);
        });
        root.addEventListener('unhandledrejection', function(ev) {
            Chaos.Log.error('unhandledrejection', ev && ev.reason);
        });
    } catch (e2) {}
})();
