/**
 * @file web 服务器
 * @author sparklewhy@gmail.com
 */

var path = require('path');
var fs = require('fs');
var util = require('./util');

/**
 * 默认配置文件名
 *
 * @const
 * @type {string}
 */
var DEFAULT_CONF_FILE = 'edp-webserver-config.js';

/**
 * 加载配置文件
 *
 * @inner
 * @param {string=} configFile 配置文件
 * @param {Object} options 选项
 * @return {Object}
 */
function loadConf(configFile, options) {
    if (!configFile) {
        configFile = fis.config.get('server.configFile') || DEFAULT_CONF_FILE;
    }

    if (!configFile) {
        return;
    }

    var findup = require('findup');
    try {
        var dir = findup.sync(options.wwwRoot || process.cwd(), configFile);
        if (dir) {
            options.wwwRoot = dir;
            try {
                return require(path.join(dir, configFile));
            }
            catch (ex) {
                fis.log.error(ex.stack);
            }
        }
    }
    catch (ex) {
        // not found
    }

    return require('edp-webserver').getDefaultConfig();
}

/**
 * 启动服务器
 *
 * @param {Object} options 启动选项
 * @param {string} options.root 项目根目录
 * @param {string=} options.wwwRoot 服务器根目录
 * @param {number=} options.port 启动的端口
 * @param {string=} options.configFile 服务器配置文件
 * @param {string=} options.proxy 代理配置文件
 * @param {boolean=} options.serveRelease 是否使用构建发布的静态资源进行查看
 */
exports.start = function (options) {
    var config = loadConf(options.configFile, options);
    if (!config) {
        fis.log.error('no server config file is found!');
        return;
    }

    var cwd = process.cwd();
    if (options.wwwRoot) {
        config.documentRoot = path.resolve(cwd, options.wwwRoot);
    }

    if (options.port) {
        config.port = options.port;
    }

    // 初始化代理配置
    var proxy = options.proxy;
    if (proxy) {
        var proxyFile = path.resolve(cwd, proxy);
        if (util.isFileExists(proxyFile)) {
            config.proxyMap = JSON.parse(fs.readFileSync(proxyFile, 'utf8'));
        }
    }

    // 注入全局资源处理接口
    var injectResource = config.injectResource || config.injectRes;
    var resource = require('edp-webserver/lib/resource');
    var livereload = resource.livereload;
    delete resource.livereload;
    injectResource && injectResource({
        autoresponse: require('autoresponse'),
        requireConfigInjector: require('./injector')
            .getRequireConfigInjector.bind(this, options),
        livereload: function (handlerOpts) {
            return function () {
                if (options.serveRelease) {
                    return;
                }
                return livereload(handlerOpts).apply(this, arguments);
            };
        }
    });

    // 启动
    var start = require('edp-webserver/lib/start');
    if (options.serveRelease) {
        config.documentRoot = path.join(options.root, fis.get('release.dir'));
    }
    var startServer = function (conf) {
        start(conf).on('request', function (req, res) {
            if (options.serveRelease) {
                req.headers['fisx_release'] = 1;
            }
        });
    };
    if (typeof config.init === 'function') {
        config.init(config, function (conf) {
            startServer(conf || config);
        });
    }
    else {
        startServer(config);
    }
};
