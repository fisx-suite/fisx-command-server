/**
 * @file require css 预处理器
 * @author sparklewhy@gmail.com
 */

var url = require('url');
var path = require('path');
var fs = require('fs');
var styleFileRegExp = /\.(css|styl|sass|less)($|\?)/;

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

function requireCssProcess(context, options) {
    var reqPathName = context.request.pathname.substr(1);
    var docRoot = context.conf.documentRoot;
    var md5 = fis.util.md5;
    var styleModules = [];

    var wrServer = fis.wrServer;
    var depManage = wrServer && wrServer.resDepManage;
    var depStyleFiles = [];
    var content = context.content.toString().replace(
        /(\s*)require\s*\(\s*(['"])([^'"]+)\2\s*\)/g,
        function (match, prefix, quot, id) {
            if (!styleFileRegExp.test(id)) {
                return match;
            }

            var styleUrl = url.parse(id);
            var styleModuleId;
            var insertStyle;
            var styleFilePath = path.join(
                docRoot, path.dirname(reqPathName),
                styleUrl.pathname
            );
            depStyleFiles.push(styleFilePath);

            if (options.inline) {
                insertStyle = fs.readFileSync(styleFilePath).toString();
                styleModuleId = md5(styleFilePath, 8);
            }
            else {
                insertStyle = '/' + path.join(
                    path.dirname(reqPathName), styleUrl.pathname
                ).replace(/\\/g, '/');
                styleModuleId = md5(insertStyle, 8);
            }

            var styleModName = '_' + styleModuleId;
            styleModules.push(styleModName);

            return prefix + 'var ' + styleModName + '=require("insert-css").insert('
                + JSON.stringify(insertStyle)
                + (options.inline ? '' : ', true') + ')';
        }
    );

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
}

module.exports = exports = function (context) {
    return requireCssProcess(context, {});
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
