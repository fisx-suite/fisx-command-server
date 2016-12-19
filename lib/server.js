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
            return require(path.join(dir, configFile));
        }
    }
    catch (ex) {
        fis.log.warn(ex.stack);
    }

    return require('edp-webserver').getDefaultConfig();
}

function getCustomLogger(prefix, color) {
    return function (level, msg) {
        if (level === 'error') {
            // fis log error 级别会导致程序退出。。
            level = 'warn';
            msg = msg.red;
        }

        var logger = fis.log[level];
        logger && logger.call(fis.log, ('[' + prefix + '] ')[color || 'green'] + msg);
    };
}

function rewriteEDPLogger() {
    var modPath = path.dirname(require.resolve('edp-webserver'));

    var edpCoreMod = null;
    try {
        edpCoreMod = require(path.join(modPath, 'node_modules', 'edp-core'));
    }
    catch (ex) {
        try {
            edpCoreMod = require(path.join(modPath, '..', 'edp-core'));
        }
        catch (ex) {

        }
    }

    if (!edpCoreMod) {
        return;
    }

    var util = require('util');
    var customLog = getCustomLogger('SERVER');
    edpCoreMod.log.info = function () {
        var msg = util.format.apply(util.format, arguments);
        customLog('info', msg);
    };
    edpCoreMod.log.debug = function () {
        var msg = util.format.apply(util.format, arguments);
        customLog('debug', msg);
    };
    edpCoreMod.log.warn = function () {
        var msg = util.format.apply(util.format, arguments);
        customLog('warn', msg);
    };
    edpCoreMod.log.error = function () {
        var msg = util.format.apply(util.format, arguments);
        customLog('error', msg);
    };
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
        fis.log.warn('no server config file is found!');
        return;
    }

    config.logger = false;

    rewriteEDPLogger();

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
    injectResource && injectResource({
        cjs2amd: require('./amd-wrap'),
        autoresponse: function (type, options) {
            if (arguments.length === 1) {
                options = type;
                type = 'edp';
            }
            else {
                type = 'edp';
            }
            var opts = fis.util.assign({
                logger: getCustomLogger('AUTO_RESPONSE', 'grey')
            }, options || {});
            return require('autoresponse')(type, opts);
        },
        requireConfigInjector: require('./injector')
            .getRequireConfigInjector.bind(this, options),
        babelProcessor: require('./babel-processor'),
        vueProcessor: require('./vue-processor')
    });

    // 启动
    var start = require('edp-webserver/lib/start');
    if (options.serveRelease) {
        config.documentRoot = path.join(options.root, fis.get('release.dir'));
    }

    var serverDefaults = require('edp-webserver/lib/middleware/defaults');
    var rawAttachTo = serverDefaults.attachTo;
    serverDefaults.attachTo = function (app, config) {
        app.use(require('./logger')(config));
        var watchReloadConfig = config.watchreload;
        if (!options.serveRelease && watchReloadConfig !== false) {
            // 创建 watch reload server
            if (typeof watchReloadConfig === 'function') {
                watchReloadConfig = watchReloadConfig();
            }
            watchReloadConfig || (watchReloadConfig = {});

            var wr = require('watchreload-server');
            fis.wrServer = new wr.Server(fis.util.assign(
                {
                    files: [
                        'src/**/*'
                    ]
                }, watchReloadConfig, {
                    logger: getCustomLogger('WATCH_RELOAD', 'cyan'),
                    app: app,
                    protocol: config.protocol,
                    port: config.port,
                    basePath: config.documentRoot
                }));
        }

        rawAttachTo.apply(this, arguments);
    };

    var startServer = function (conf) {
        var webServer = start(conf).on('request', function (req, res) {
            if (options.serveRelease) {
                /* eslint-disable dot-notation */
                req.headers['fisx_release'] = 1;
                /* eslint-enable dot-notation */
            }
        });

        // 启动 watchreload server
        fis.wrServer && fis.wrServer.start(webServer);
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
