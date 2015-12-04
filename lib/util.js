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
