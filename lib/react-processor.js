/**
 * @file react 相关处理器
 * @author sparklewhy@gmail.com
 */

var util = require('./util');

function getReactHandlers(options) {
    options || (options = {});

    var reactHotLoaderCode;
    return {
        hmr: {
            location: /^\/dev\/react-hot-loader\.js($|\?)/,
            handler: [
                function (context) {
                    if (!reactHotLoaderCode) {
                        var hrFile = options.isProd
                            ? 'react-hot-loader.prod'
                            : 'react-hot-loader.dev';
                        if (!options.debug) {
                            hrFile += '.min';
                        }
                        var filePath = util.resolveRequire('react-hmr/dist/' + hrFile);
                        var fs = require('fs');
                        reactHotLoaderCode = fs.readFileSync(filePath);
                    }
                    context.content = reactHotLoaderCode;
                }
            ]
        }
    };
}

module.exports = exports = getReactHandlers;

