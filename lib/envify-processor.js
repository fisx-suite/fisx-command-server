/**
 * @file 替换 node 的一些环境变量，只是简单字符串替换，更健壮的工具参考
 *       https://github.com/hughsk/envify
 * @author sparkelwhy@gmail.com
 */

function replaceProcessEnv(context) {
    /* eslint-disable fecs-dot-notation */
    var isRelease = context.request.headers['fisx_release'];
    /* eslint-enable fecs-dot-notation */
    var env = isRelease ? 'production' : 'development';
    context.content = context.content.toString()
        .replace(
            /process\.env\.NODE_ENV/g,
            '\'' + env + '\''
        );
}

module.exports = exports = replaceProcessEnv;

exports.create = function (options) {
    options || (options = {});
    var envify = replaceProcessEnv;
    if (typeof options.envify === 'function') {
        envify = options.envify;
    }

    return function (context) {
        return envify.apply(this, arguments);
    };
};
