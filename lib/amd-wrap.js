/**
 * @file 将 cjs 模块转成 amd 模块的 插件
 * @author sparklewhy@gmail.com
 */

module.exports = exports = function (context) {
    var code = context.content.toString();
    if (!/^\s*define\s*\(\s*/.test(code)) {
        context.content = 'define(function (require, exports, module) {'
            + code + '\n});\n';
    }
};
