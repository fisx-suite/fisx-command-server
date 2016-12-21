/**
 * @file 工具方法
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');

/**
 * 获取给定的文件路径的状态信息
 *
 * @inner
 * @param {string} target 文件的目标路径
 * @return {?Object}
 */
function getFileState(target) {
    try {
        var state = fs.statSync(target);
        return state;
    }
    catch (ex) {
        return null;
    }
}

/**
 * 判断给定的文件路径是否存在
 *
 * @param {string} target 要判断的目标路径
 * @return {boolean}
 */
exports.isFileExists = function (target) {
    var state = getFileState(target);
    return state && state.isFile();
};

/**
 * 读取文件内容
 *
 * @param {string} filePath 要读取文件路径
 * @param {string=} encoding 文件编码
 * @return {string}
 */
exports.readFile = function (filePath, encoding) {
    return fs.readFileSync(filePath, encoding || 'utf-8').toString();
};

/**
 * 渲染给定的模板
 *
 * @param {string} tpl 要渲染的模板
 * @param {Object} data 要渲染的模板数据
 * @return {string}
 */
exports.renderTpl = function (tpl, data) {
    return tpl.replace(/\$\{([^\}]+)\}/, function (match, key) {
        return data[key];
    });
};

/**
 * 获取一个高精度计时器对象
 *
 * @return {Object}
 */
exports.timer = function () {
    var prettyHrtime = require('pretty-hrtime');
    var startTime;
    var lastStartTime;
    return {
        start: function () {
            startTime = lastStartTime = process.hrtime();
        },
        tick: function () {
            var endTime = process.hrtime(lastStartTime);
            lastStartTime = process.hrtime();
            return prettyHrtime(endTime);
        },
        restart: function () {
            this.start();
        },
        elapsedTime: function () {
            var endTime = process.hrtime(startTime);
            return prettyHrtime(endTime);
        }
    };
};

/**
 * require 项目的模块
 *
 * @param {string} moduleId 要 resolve 的 模块 id
 * @return {?string}
 */
exports.resolveRequire = function (moduleId) {
    var path = require('path');
    var projDir = fis.project.getProjectPath();
    var isRelativeId = /^\./.test(moduleId);
    try {
        var modPath;
        if (isRelativeId) {
            modPath = path.join(projDir, moduleId);
        }
        else {
            modPath = path.join(projDir, 'node_modules', moduleId);
        }
        return require.resolve(modPath);
    }
    catch (ex) {
        if (isRelativeId) {
            fis.log.warn(
                'require moduleId %s is not existed in %s',
                moduleId, projDir
            );
        }
        else {
            fis.log.warn(
                'missing dependence %s in %s',
                moduleId.split('/')[0], projDir
            );
        }
    }
};

/**
 * require 项目的模块
 *
 * @param {string} moduleId 要 require 的 模块 id
 * @return {*}
 */
exports.require = function (moduleId) {
    var modFilePath = exports.resolveRequire(moduleId);
    if (modFilePath) {
        return require(modFilePath);
    }
};
