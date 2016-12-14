/**
 * @file vue 相关的处理器
 * @author sparkelwhy@gmail.com
 */

/* global file:false */

var path = require('path');
var fs = require('fs');
var cjs2amd = require('./amd-wrap');
var util = require('./util');

var babelHelperInitCode = require('./babel-processor').BABEL_HELP_INIT_CODE;

var insertCss = null;
var hotReloadApi = null;

var insertCssPath;
var hotReloadApiPath;

function processVueFile(filePath, context, vueLoader, options) {
    var content = util.readFile(filePath);
    var timer = util.timer();
    timer.start();

    var opts = fis.util.assign({
        insertCSSPath: function (id) {
            insertCssPath = id + '.js';
            return 'insert-css';
        },
        hotReloadAPIPath: function (id) {
            hotReloadApiPath = id + '/index.js';
            return 'vue-hot-reload-api';
        },
        sourceMap: true
    }, options || {});
    var result = vueLoader.compile(filePath, content, opts);
    fis.log.info('compile vue time: %s - %s',
        timer.elapsedTime(),
        context.request.pathname
    );
    context.content = babelHelperInitCode + result.content;
}

/**
 * 获取 vue 相关处理器
 *
 * @param {Object} options 选项
 * @param {Object=} options.parser 要使用的自定义 parser
 * @param {Object=} options.fisParser 要使用的自定义 FIS parser
 * @param {Object=} options.vue 编译 vue 的选项
 * @param {Object} options.vueLoader 使用的 vue loader
 * @param {string=} options.insertCssPath 自定义的加载的 css 插入模块路径
 * @param {string=} options.hotReloadApiPath 自定义的热加载 api 模块路径
 * @param {Function=} options.defaultSrcHandler 默认的 src 源文件处理器
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

    var currDir = process.cwd();
    return {
        vuePkg: {
            location: /^\/dep\/vue\/.*?\.js($|\?)/,
            handler: [
                file(),
                function (context) {
                    /* eslint-disable dot-notation */
                    var isRelease = context.request.headers['fisx_release'];
                    /* eslint-enable dot-notation */
                    var env = isRelease ? 'production' : 'development';
                    context.content = context.content.toString()
                        .replace(
                            /process\.env\.NODE_ENV/g,
                            '\'' + env + '\''
                        );
                },
                cjs2amd
            ]
        },

        insertCss: {
            location: /\/insert\-css\.js($|\?)/,
            handler: [
                function (context) {
                    if (!insertCss) {
                        insertCss = fs.readFileSync(
                            options.insertCssPath || path.join(
                                currDir,
                                'node_modules',
                                insertCssPath
                            )
                        ).toString();
                    }
                    context.content = insertCss;
                },
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
                            options.hotReloadApiPath || path.join(
                                currDir,
                                'node_modules',
                                hotReloadApiPath
                            )
                        ).toString();
                    }
                    context.content = hotReloadApi;
                },
                cjs2amd
            ]
        },

        vue: {
            location: /^\/src\/.*?\.js($|\?)/,
            handler: [
                function (context) {
                    var docRoot = context.conf.documentRoot;
                    var pathname = context.request.pathname;
                    var filePath = docRoot + pathname;

                    if (util.isFileExists(filePath)) {
                        context.content = util.readFile(filePath);
                        options.defaultSrcHandler
                        && options.defaultSrcHandler(context.content, context);
                        return;
                    }

                    if (/\.vue\.js$/.test(pathname)) {
                        filePath = filePath.replace(/\.js$/, '');
                        if (util.isFileExists(filePath)) {
                            return processVueFile(
                                filePath,
                                context,
                                vueLoader,
                                options.vue
                            );
                        }
                    }

                    // filePath = (docRoot + pathname).replace(/\.js/, '.vue');
                    // if (util.isFileExists(filePath)) {
                    //     return processVueFile(
                    //         filePath,
                    //         context,
                    //         vueLoader,
                    //         options.vue
                    //     );
                    // }
                    context.status = 404;

                },
                cjs2amd
            ]
        },

        getCustomPathMap: function () {
            return {
                'insert-css': 'insert-css',
                'hot-reload-api': 'hot-reload-api'
            };
        }
    };
}

module.exports = exports = getVueHandlers;
