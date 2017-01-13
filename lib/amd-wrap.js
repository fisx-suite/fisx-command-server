/**
 * @file 将 cjs 模块转成 amd 模块的 插件
 * @author sparklewhy@gmail.com
 */

var amdWrapper = require('amd-wrapper');

var amdRequireConfig = null;
function getAMDRequireConfig() {
    if (!amdRequireConfig) {
        amdRequireConfig = fis.getModuleConfig() || {};
    }
    return amdRequireConfig;
}

function transformCommonJS(context, options) {
    var code = context.content.toString();
    context.content = amdWrapper(code, Object.assign({
        filePath: context.request.pathname.substr(1),
        requireConfig: getAMDRequireConfig,
        projectRoot: fis.project.getProjectPath(),
        componentDirName: fis.getDepDirName(),
        checkUMD: true
    }, options || {}));
}

module.exports = exports = function (context) {
    return transformCommonJS(context, {});
};

exports.create = function (options) {
    return function (context) {
        transformCommonJS(context, options);
    };
};
