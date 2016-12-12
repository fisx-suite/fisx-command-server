/**
 * @file babel 相关的处理器
 * @author sparklewhy@gmail.com
 */

/* global file:false */

var qrequire = require('qrequire');
var cjs2amd = require('./amd-wrap');
var util = require('./util');

var babelHelperInitCode = 'var babelHelpers = require("babelHelpers");\n';
var babelHelpers = null;

function processESFile(babel, babelOptions, content, context) {
    var opts = fis.util.assign({
        compact: false,
        ast: false,
        sourceMaps: 'inline',
        filename: context.request.pathname.substr(1)
    }, babelOptions);
    try {
        var timer = util.timer();
        timer.start();

        qrequire.hook();
        context.content = babelHelperInitCode
            + babel.transform(content.toString(), opts).code;
        qrequire.unhook();

        fis.log.info('babel compile time: %s - %s',
            timer.elapsedTime(),
            context.request.pathname
        );
    }
    catch (e) {
        fis.log.warn(e.stack);
        context.status = 500;
    }
}

/**
 * 获取 babel 相关处理器
 *
 * @param {Object} babelParser babel parser
 * @param {Object=} babelOptions babel options
 * @return {Object}
 */
function getBabelHandlers(babelParser, babelOptions) {
    babelOptions || (babelOptions = {});

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
        processESFile: processESFile
    };
}

module.exports = exports = getBabelHandlers;

exports.BABEL_HELP_INIT_CODE = babelHelperInitCode;
