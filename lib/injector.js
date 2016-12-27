/**
 * @file 文件内容注入
 * @author sparklewhy@gmail.com
 */

var _ = fis.util;
var util = require('./util');

var REQUIRE_CONFIG_INJECT_FLAG = '<!-- requireconfig injected -->';

var moduleConfig;

/**
 * 查找 AMD 模块配置
 *
 * @return {?Object}
 */
function findAMDModuleConfig() {
    if (moduleConfig) {
        return moduleConfig;
    }

    return (moduleConfig = fis.getModuleConfig());
}

function mergeRequireConfigPackages(rawPackages, upPackages) {
    var existedMap = {};
    rawPackages.forEach(function (item) {
        existedMap[item.name] = item;
    });

    upPackages.forEach(function (item) {
        var name = item.name;
        if (existedMap[name]) {
            var index = rawPackages.indexOf(existedMap[name]);
            var newPkg = _.assign(existedMap[name], item);
            rawPackages.splice(index, 1, newPkg);
            existedMap[name] = newPkg;
        }
        else {
            rawPackages.push(item);
            existedMap[name] = item;
        }
    });

    return rawPackages;
}

/**
 * 获取 require.config 内容
 *
 * @inner
 * @param {Object} options 注入选项
 * @param {Object} context 当前请求上下文
 * @return {?Object}
 */
function getRequireConfig(options, context) {
    var customConfig = options.requireConfig;
    var requireConfig = findAMDModuleConfig();
    if (_.isFunction(customConfig)) {
        requireConfig = customConfig(requireConfig, context);
    }
    else if (_.isPlainObject(customConfig)) {
        var rawPaths = requireConfig.paths;
        var rawMap = requireConfig.map;
        var rawPackages = requireConfig.packages;
        requireConfig = _.assign(requireConfig || {}, {waitSeconds: 5}, customConfig);
        if (customConfig.paths && rawPaths) {
            requireConfig.paths = _.assign(rawPaths, customConfig.paths);
        }
        if (customConfig.map && rawMap) {
            requireConfig.map = _.assign(rawMap, customConfig.map);
        }
        if (customConfig.packages && rawPackages) {
            requireConfig.packages = mergeRequireConfigPackages(rawPackages, customConfig.packages);
        }
    }

    var conf = context.conf;
    var devServerHost = require('edp-webserver/lib/util/ip');
    if (+conf.port !== 80 && conf.port) {
        devServerHost += ':' + conf.port;
    }
    if (!customConfig.baseUrl && requireConfig.baseUrl === 'src') {
        requireConfig.baseUrl = '//' + devServerHost + '/src';
    }

    var isHttps = !!context.request.connection.encrypted;
    var host = context.request.headers.host;
    host = (isHttps ? 'https://' : 'http://') + host;
    var data = {host: host};
    Object.keys(requireConfig || {}).forEach(function (k) {
        var value = requireConfig[k];
        if (_.isString(value)) {
            requireConfig[k] = util.renderTpl(value, data);
        }
    });
    return requireConfig;
}

/**
 * 判断是否是模块加载器脚本文件
 *
 * @inner
 * @param {string|RegExp|function(string):boolean=} loaderScript
 *        判断页面引用的脚本文件是不是模块加载器脚本
 * @param {string} src 脚本文件 url
 * @return {boolean}
 */
function isLoaderScript(loaderScript, src) {
    loaderScript || (loaderScript = 'esl.js');
    if (_.isRegExp(loaderScript)) {
        return loaderScript.test(src);
    }
    else if (_.isFunction(loaderScript)) {
        return loaderScript(src);
    }
    else if (_.isString(loaderScript)) {
        return _.ext(src).basename === loaderScript;
    }
    return false;
}

/**
 * 注入 require.config 脚本内容
 *
 * @inner
 * @param {string} content 要注入的源的内容
 * @param {Object} requireConfig 要注入的配置
 * @param {Object} options 注入选项
 * @return {string}
 */
function injectRequireConfig(content, requireConfig, options) {
    var placeholder = options.placeholder;
    var inited = false;

    if (content.indexOf(placeholder) === -1) {
        content = _.parseHtmlScript(content, function (found) {
            var match = found.match;
            if (inited) {
                return match;
            }

            if (found.isScriptLink) {
                var src = found.src;
                if (found.isLoader || options.isLoaderScript(src)) {
                    inited = true;
                    return match + placeholder;
                }
            }

            return match;
        });
    }

    if (inited) {
        return content.replace(placeholder, REQUIRE_CONFIG_INJECT_FLAG
            + _.createRequireConfigScript(requireConfig));
    }
    return content;
}

/**
 * 获取 `require.config` 内容注入器
 *
 * @param {Object} serverOption 服务器选项
 * @param {Object} options 注入选项
 * @param {Object|Function=} options.requireConfig 要定制的 require.config，
 *        会和 fisx-hook-amd 传入的配置做合并，如果传入的是普通对象的话
 * @param {string|RegExp|function(string):boolean=} options.loaderScript
 *        判断页面引用的脚本文件是不是模块加载器脚本
 * @return {Function}
 */
exports.getRequireConfigInjector = function (serverOption, options) {
    options || (options = {});
    _.assign(options, serverOption);
    var checkLoader = isLoaderScript.bind(this, options.loaderScript);
    return function (context) {
        if (options.serveRelease) {
            return;
        }

        var header = context.header;
        var contentType;
        var contentEncoding;
        var contentEncodingKey;
        Object.keys(header).forEach(function (k) {
            var key = k.toLowerCase();
            if (key === 'content-type') {
                contentType = header[k];
            }
            else if (key === 'content-encoding') {
                contentEncodingKey = k;
                contentEncoding = header[k].toLowerCase();
            }
        });

        context.stop();

        var inject = function () {
            var content = context.content.toString(options.encoding);
            var injected = content.indexOf(REQUIRE_CONFIG_INJECT_FLAG) !== -1;
            if (!injected
                && /^text\//i.test(contentType || '')
                && /<html/i.test(content)
            ) {
                var requireConfig = getRequireConfig(options, context);
                if (requireConfig) {
                    context.content = injectRequireConfig(content, requireConfig, {
                        placeholder: fis.config.get('placeholder.requireconfig'),
                        isLoaderScript: checkLoader
                    });
                }
            }
            context.start();
        };

        var zlib = require('zlib');
        switch (contentEncoding) {
            case 'gzip':
            case 'deflate':
                zlib.unzip(context.content, function (err, buffer) {
                    if (err) {
                        fis.log.warn(err);
                    }
                    else {
                        delete context.header[contentEncodingKey];
                        context.content = buffer;
                    }
                    inject();
                });
                break;
            default:
                inject();
        }
    };
};
