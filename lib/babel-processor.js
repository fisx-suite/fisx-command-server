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

var babelHelperInitCode = 'var babelHelpers = require("babelHelpers");';
var babelHelpers = null;

function processESFile(babel, babelOptions, content, context) {
    var opts = fis.util.assign({
        compact: false,
        ast: false,
        sourceRoot: config.sourceMapRoot,
        sourceMaps: 'inline',
        filename: context.request.pathname.substr(1)
    }, babelOptions);
    try {
        qrequire.hook();
        context.content = babelHelperInitCode
            + babel.transform(content.toString(), opts).code;
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
    options || (options = {});
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
 * @param {Object=} babelParser babel parser
 * @return {Object}
 */
function getBabelHandlers(options, babelParser) {
    var babelOptions = readBabelConfig(options);
    if (!babelParser) {
        babelParser = util.require('babel-core');
    }

    return {
        babelHelper: {
            location: /\/src\/babelHelpers\.js($|\?)/,
            handler: [
                function (context) {
                    if (!babelHelpers) {
                        babelHelpers = babelParser.buildExternalHelpers(null, 'umd');
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
                        babelParser, babelOptions, context.content, context
                    );
                },
                cjs2amd
            ]
        },
        processESFile: function (context) {
            return processESFile(
                babelParser, babelOptions, context.content, context
            );
        },
        getBabelConfig: readBabelConfig
    };
}

module.exports = exports = getBabelHandlers;

exports.BABEL_HELP_INIT_CODE = babelHelperInitCode;
