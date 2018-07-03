/**
 * @file vue 相关的处理器
 * @author sparkelwhy@gmail.com
 */

/* global file:false */

var path = require('path');
var fs = require('fs');
var cjs2amd = require('./amd-wrap');
var util = require('./util');
var config = require('./config');
var requireCssProcessor = require('./require-css-processor');
var babelHelperInitCode = require('./babel-processor').BABEL_HELP_INIT_CODE;

var hotReloadApi = null;
var hotReloadApiPath;

function initVueDepInfo(filePath, result) {
    var wrServer = fis.wrServer;
    if (!wrServer) {
        return;
    }
    var depManage = wrServer.resDepManage;

    var resolveParts = result.resolveParts;

    // add tpl dep
    var tplPart = resolveParts.template || {};
    var deps = [];
    if (tplPart.filePath) {
        deps.push(tplPart.filePath);
    }

    // add style dep
    var styleParts = resolveParts.styles;
    styleParts.forEach(function (style, index) {
        if (style.filePath) {
            deps.push(style.filePath);
        }

        var output = style.output;
        output.deps.forEach(function (depFile) {
            deps.push(depFile);
        });
    });

    // add script file dependence
    var scriptPart = resolveParts.script || {};
    if (scriptPart.filePath) {
        deps.push(scriptPart.filePath);
    }

    depManage.addDepInfo(filePath, deps);
}

function processVueFile(filePath, context, vueLoader, options, extractBabelHelper) {
    var content = util.readFile(filePath);
    var opts = fis.util.assign({
        insertCSSPath: 'insert-css',
        hotReloadAPIPath: function (id) {
            var pkgPath = path.join(
                process.cwd(),
                'node_modules',
                id
            );

            try {
                var pkgInfo = require(pkgPath + '/package.json');
                var main = pkgInfo.main;
                hotReloadApiPath = path.join(pkgPath, main || 'index.js');
            }
            catch (ex) {
                console.error(ex);
            }

            return 'vue-hot-reload-api';
        },
        sourceMap: {
            sourceRoot: config.sourceMapRoot,
            file: context.request.pathname.substr(1)
        }
    }, options || {});

    var result = vueLoader.compile(filePath, content, opts);
    var extraCode = babelHelperInitCode;
    if (extractBabelHelper === false
        || (opts.script && opts.script.lang
            && opts.script.lang !== 'babel')
    ) {
        extraCode = '';
    }

    context.content = extraCode + result.content;

    initVueDepInfo(filePath, result);
}

/**
 * 获取 vue 相关处理器
 *
 * @param {Object} options 选项
 * @param {Object=} options.parser 要使用的自定义 parser
 * @param {Object=} options.fisParser 要使用的自定义 FIS parser
 * @param {Object=} options.vue 编译 vue 的选项
 * @param {Object} options.vueLoader 使用的 vue loader
 * @param {string=} options.hotReloadApiPath 自定义的热加载 api 模块路径
 * @param {boolean=} options.extractBabelHelper 是否提取 babel helper 代码，可选，默认 true
 * @param {Object|boolean=} options.requireCss requireCss 处理的选项，
 *        具体参考 `require-css-processor` 选项说明，如果不需要设为 false，默认 true
 * @return {Object}
 */
function getVueHandlers(options) {
    var vueLoader = options.vueLoader;
    if (options.parser) {
        vueLoader.registerParser(options.parser);
    }

    if (options.fisParser) {
        vueLoader.registerFisParser(options.fisParser);
    }

    var requireCssHandler = requireCssProcessor;
    if (options.requireCss === false) {
        requireCssHandler = function () {};
    }
    else if (options.requireCss) {
        requireCssHandler = requireCssProcessor.create(options.requireCss);
    }

    return {
        vuePkg: {
            location: /^\/dep\/vue\/.*?\.js($|\?)/,
            handler: [
                file(),
                require('./envify-processor'),
                cjs2amd
            ]
        },

        hotReloadApi: {
            location: /\/vue\-hot\-reload\-api\.js($|\?)/,
            handler: [
                function (context) {
                    if (!hotReloadApi) {
                        if (!hotReloadApiPath) {
                            var pathName = context.request.pathname;
                            pathName = pathName
                                .replace(/^\/*(src|asset)\//, '')
                                .replace(/\.js$/, '');
                            hotReloadApiPath = pathName + '/index.js';
                        }
                        hotReloadApi = fs.readFileSync(
                            options.hotReloadApiPath || hotReloadApiPath
                        ).toString();
                    }
                    context.content = hotReloadApi;
                },
                cjs2amd
            ]
        },

        vue: {
            location: /^\/src\/.*?\.vue\.js($|\?)/,
            handler: [
                function (context) {
                    var docRoot = context.conf.documentRoot;
                    var pathname = context.request.pathname;
                    var filePath = docRoot + pathname;

                    filePath = filePath.replace(/\.js$/, '');
                    if (util.isFileExists(filePath)) {
                        return processVueFile(
                            filePath,
                            context,
                            vueLoader,
                            options.vue,
                            options.extractBabelHelper
                        );
                    }

                    context.status = 404;
                },
                cjs2amd,
                requireCssHandler
            ]
        }
    };
}

module.exports = exports = getVueHandlers;
