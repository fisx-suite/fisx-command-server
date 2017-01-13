/**
 * @file babel 相关的处理器
 * @author sparklewhy@gmail.com
 */

/* global file:false */
var path = require('path');
var qrequire = require('qrequire');
var cjs2amd = require('./amd-wrap');
var config = require('./config');
var util = require('./util');
var requireCssProcessor = require('./require-css-processor');

var babelHelperInitCode = 'var babelHelpers = require("babelHelpers");';
var babelHelpers = null;

function processESFile(babel, babelOptions, extractBabelHelper, content, context) {
    var opts = fis.util.assign({
        compact: false,
        ast: false,
        sourceRoot: config.sourceMapRoot,
        sourceMaps: 'inline',
        filename: context.request.pathname.substr(1)
    }, babelOptions);

    try {
        var code = content.toString();
        var isAmdModule = /^\s*define\s*\(\s*/.test(code);

        qrequire.hook();
        var extraCode = extractBabelHelper === false || isAmdModule
            ? '' : babelHelperInitCode;
        code = extraCode + babel.transform(code, opts).code;

        // 移除 babel 编译后前面加上的 use strict 语句
        if (isAmdModule) {
            code = code.replace(/^[\s\S]*?(\s*define\s*\()/, '$1');
        }

        context.content = code;
        qrequire.unhook();
    }
    catch (e) {
        fis.log.warn(e.stack);
        context.status = 500;
    }
}

/**
 * 读取 babel 配置
 *
 * @param {Object=} options 选项
 * @param {string=} options.projectDir 项目目录，可选，默认为当前执行的目录
 * @return {Object}
 */
function readBabelConfig(options) {
    var babelOpts;

    var _ = fis.util;
    var currDir = options.projectDir || fis.project.getProjectPath();
    var babelRcFile = path.resolve(currDir, '.babelrc');
    if (_.isFile(babelRcFile)) {
        babelOpts = require('json5').parse(
            require('fs').readFileSync(babelRcFile, 'utf-8')
        );
    }
    else {
        var pkgMetaFile = path.resolve(currDir, 'package.json');
        if (_.isFile(pkgMetaFile)) {
            babelOpts = require(pkgMetaFile).babel;
        }
    }

    babelOpts || (babelOpts = {});
    babelOpts = _.clone(babelOpts); // 避免对 package.json 缓存数据修改
    var sourceMap = options.sourceMap;
    if (sourceMap != null) {
        babelOpts.sourceMaps = sourceMap;
    }

    if (options.enableReactHMR) {
        var plugins = babelOpts.plugins || [];
        babelOpts.plugins = plugins;
        var reactHMRPlugin = options.reactHMRPlugin || 'react-hmr/babel';
        if (plugins.indexOf(reactHMRPlugin) === -1) {
            plugins.push(reactHMRPlugin);
        }
    }

    return _.assign(babelOpts, options.babel || {});
}

/**
 * 获取 babel 相关处理器
 *
 * @param {Object} options babel options
 * @param {Object=} options.babel babel 自定义编译选项，默认会从 babel 默认指定的配置定义位置读取，
 *        具体选项见这里 https://babeljs.io/docs/core-packages/#options
 * @param {string|boolean=} options.sourceMap babel sourceMap 选项，优先级高于默认定义
 *        的配置文件，低于 options.babel 定义
 * @param {boolean=} options.enableReactHMR 是否启用 react hmr 支持的 babel 编译，默认 false
 * @param {string=} options.projectDir 项目目录，可选，默认为当前执行的目录
 * @param {boolean=} options.extractBabelHelper 是否提取 babel helper 代码，可选，默认 true
 * @param {Object|boolean=} options.requireCss requireCss 处理的选项，
 *        具体参考 `require-css-processor` 选项说明，如果不需要设为 false，默认 true
 * @param {Object=} babelParser babel parser
 * @return {Object}
 */
function getBabelHandlers(options, babelParser) {
    options || (options = {});
    var babelOptions = readBabelConfig(options);
    if (!babelParser) {
        babelParser = util.require('babel-core');
    }

    var requireCssHandler = requireCssProcessor;
    if (options.requireCss === false) {
        requireCssHandler = function () {};
    }
    else if (options.requireCss) {
        requireCssHandler = requireCssProcessor.create(options.requireCss);
    }

    return {
        babelHelper: {
            location: /\/src\/babelHelpers\.js($|\?)/,
            handler: [
                function (context) {
                    if (!babelHelpers) {
                        babelHelpers = babelParser.buildExternalHelpers(
                            null, 'umd'
                        );
                    }
                    context.content = babelHelpers;
                }
            ]
        },
        babel: {
            location: /^\/src\/.*?\.js($|\?)/,
            handler: [
                file(),
                function (context) {
                    return processESFile(
                        babelParser, babelOptions,
                        options.extractBabelHelper,
                        context.content, context
                    );
                },
                cjs2amd,
                requireCssHandler
            ]
        },

        processESFile: function (context) {
            return processESFile(
                babelParser, babelOptions,
                options.extractBabelHelper,
                context.content, context
            );
        },
        getBabelConfig: readBabelConfig
    };
}

module.exports = exports = getBabelHandlers;

exports.BABEL_HELP_INIT_CODE = babelHelperInitCode;
