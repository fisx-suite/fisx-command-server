/**
 * @file require css 预处理器
 * @author sparklewhy@gmail.com
 */

var url = require('url');
var path = require('path');
var styleFileRegExp = /\.(css|styl|sass|less)($|\?)/;
var requireRegexp = /(\s*)require\s*\(\s*(['"])([^'"]+)\2\s*\)/g;

function generateHMRCode(styleModules) {
    var dispose = '';
    styleModules.forEach(function (mod) {
        dispose += mod + '(' + ');';
    });

    return [
        'if (module.hot) {',
        '(function() {',
        '    module.hot.accept();',
        '    module.hot.dispose(function () {',
        '    ' + dispose + '',
        '    });',
        '})();',
        '}'
    ].join('');
}

function reqStyleFile(context, styleFile, callback) {
    var http = require('http');
    var conf = context.conf;
    var port = +conf.port;
    http.get({
        hostname: 'localhost',
        port: port || 80,
        path: styleFile.path
    }, function (res) {
        var body = '';
        var statusCode = parseInt(res.statusCode / 100, 10);

        res.on('data', function (d) {
            body += d;
        });
        res.on('end', function () {
            callback({
                hasError: statusCode !== 2,
                content: body,
                file: styleFile
            });
        });
    });
}

function getRequireStyleFiles(reqPathName, content) {
    var styleFiles = [];
    var result;
    while ((result = requireRegexp.exec(content))) {
        var id = result[3];

        if (styleFileRegExp.test(id)) {
            var styleUrl = url.parse(id);
            var pathName = '/' + path.join(
                    path.dirname(reqPathName), styleUrl.pathname
                ).replace(/\\/g, '/');
            styleFiles.push({
                id: id,
                path: pathName
            });
        }
    }
    return styleFiles;
}

function processCssRequire(context, isInline, styleFileMap) {
    var docRoot = context.conf.documentRoot;
    var reqPathName = context.request.pathname.substr(1);
    var content = context.content.toString();

    var depStyleFiles = [];
    var styleModules = [];

    var md5 = fis.util.md5;
    content = content.replace(
        requireRegexp,
        function (match, prefix, quot, id) {
            if (!styleFileRegExp.test(id)) {
                return match;
            }

            var styleFile = styleFileMap[id];
            var insertStyle = styleFile.path;
            var styleModuleId;
            var styleFileAbsPath = path.join(
                docRoot, styleFile.path);
            depStyleFiles.push(styleFileAbsPath);

            if (isInline) {
                insertStyle = styleFile.hasError
                    ? '' : styleFile.content.toString();
                styleModuleId = md5(styleFileAbsPath, 8);
            }
            else {
                styleModuleId = md5(insertStyle, 8);
            }

            var styleModName = '_' + styleModuleId;
            styleModules.push(styleModName);

            return prefix + 'var ' + styleModName + '=require("insert-css").insert('
                + JSON.stringify(insertStyle)
                + (isInline ? '' : ', true') + ')';
        }
    );

    var wrServer = fis.wrServer;
    var depManage = wrServer && wrServer.resDepManage;
    if (styleModules.length) {
        // 添加样式依赖信息
        depManage && depManage.addDepInfo(reqPathName, depStyleFiles);

        content = content.replace(
            /\bdefine\s*\([\s\S]*?function\s*\([\s\S]*?\)\s*\{/,
            function (match) {
                return match + generateHMRCode(styleModules);
            }
        );
    }

    context.content = content;
    context.start();
}

function requireCssProcess(context, options) {
    var reqPathName = context.request.pathname.substr(1);
    var styleFiles = getRequireStyleFiles(reqPathName, context.content.toString());
    if (!styleFiles.length) {
        return;
    }

    var styleFileMap = {};
    styleFiles.forEach(function (item) {
        styleFileMap[item.id] = item;
    });

    var isInline = options.inline;
    if (options.inline) {
        context.stop();

        var styleNum = styleFiles.length;
        var counter = 0;
        var reqStyleFileDone = function (data) {
            counter++;

            var file = data.file;
            file.content = data.content;
            file.hasError = data.hasError;
            styleFileMap[file.id] = file;

            if (counter === styleNum) {
                processCssRequire(context, isInline, styleFileMap);
            }
        };

        for (var i = 0; i < styleNum; i++) {
            reqStyleFile(context, styleFiles[i], reqStyleFileDone);
        }
    }
    else {
        processCssRequire(context, isInline, styleFileMap);
    }
}

module.exports = exports = function (context) {
    return requireCssProcess(context, {inline: true});
};

/**
 * 创建 require css 处理器
 *
 * @param {Object} options 创建选项
 * @param {boolean=} options.inline 是否内联样式进行加载，默认 false
 * @return {Function}
 */
exports.create = function (options) {
    options || (options = {});

    return function (context) {
        return requireCssProcess.call(this, context, options);
    };
};
