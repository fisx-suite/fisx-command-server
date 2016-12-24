/**
 * @file 组合处理器，可以提供多个处理器按顺序处理，要求这些处理器都是非阻塞的
 * @author sparkelwhy@gmail.com
 */

function composeProcessors(processors) {
    var args = Array.prototype.slice.apply(arguments);
    args.shift();

    processors.forEach(function (item) {
        item.apply(this, args);
    }, this);
}

module.exports = exports = function (options) {
    var processors = Array.isArray(options) ? options : options.processors;
    var match = options.match;
    var handler = composeProcessors.bind(this, processors || []);
    return function (context) {
        if (typeof match === 'function' && !match(context.request.pathname)) {
            return;
        }
        return handler.apply(this, arguments);
    };
};
