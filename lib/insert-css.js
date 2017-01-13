/**
 * @file 加载 css 样式内容/文件
 * @author sparklewhy@gmail.com
 */

var inserted = exports.cache = {};

function noop() {}

function insertCssContent(css) {
    var elem = document.createElement('style');
    elem.setAttribute('type', 'text/css');

    // 移除文件内容可能存在的 UTF-8 BOM
    if (css.charCodeAt(0) === 0xFEFF) {
        css = css.substr(1, css.length);
    }

    if ('textContent' in elem) {
        elem.textContent = css;
    }
    else {
        elem.styleSheet.cssText = css;
    }

    var parent = document.getElementsByTagName('head')[0] || document.body;
    parent.appendChild(elem);
    return {
        parent: parent,
        child: elem
    };
}

function insertCssLink(href) {
    var link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.setAttribute('href', href);

    var parent = document.getElementsByTagName('head')[0] || document.body;
    parent.appendChild(link);

    return {
        parent: parent,
        child: link
    };
}

/**
 * 插入的样式
 *
 * @param {string} css 样式内容或者样式路径
 * @param {boolean=} isStylePath 是否是通过样式路径方式插入加载，可选，默认 false
 * @return {Function}
 */
exports.insert = function (css, isStylePath) {
    if (inserted[css]) {
        return noop;
    }

    inserted[css] = true;

    var result = isStylePath ? insertCssLink(css) : insertCssContent(css);
    return function () {
        result.parent.removeChild(result.child);
        result = null;
        inserted[css] = false;
    };
};
