/**
 * @file 获取插入 css 模块处理器
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');
var path = require('path');
var cjs2amd = require('./amd-wrap');

var insertCssModuleContent;

module.exports = exports = {
    location: /\/insert\-css\.js($|\?)/,
    handler: [
        function (context) {
            if (!insertCssModuleContent) {
                insertCssModuleContent = fs.readFileSync(
                    path.join(__dirname, 'insert-css.js')
                ).toString();
            }
            context.content = insertCssModuleContent;
        },
        cjs2amd
    ]
};
