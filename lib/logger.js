/**
 * @file 自定义的 logger 中间件 基于 connect-logger 修改
 * @author sparklewhy@gmail.com
 */

function getResponseStatus(res) {
    var code = res.statusCode;
    var statusInfo = '';
    if (code >= 500) {
        statusInfo = '\x1b[31m';
    }
    else if (code >= 400) {
        statusInfo = '\x1b[33m';
    }
    else if (code >= 300) {
        statusInfo = '\x1b[36m';
    }
    else if (code >= 200) {
        statusInfo = '\x1b[32m';
    }
    else {
        return code;
    }

    return statusInfo + code + '\x1b[0m';
}

function getLogMsg(req, res) {
    var urlParser = require('url');

    var prefix = '\x1b[32m[SERVER]\x1b[0m ';
    var method = '\x1b[35m' + req.method.toUpperCase() + '\x1b[0m';
    var url = '\x1b[90m'
        + (decodeURI((urlParser.parse(req.url).pathname)))
        + '\x1b[0m';
    var time = '\x1b[90m' + ((new Date() - req._startTime) + 'ms') + '\x1b[0m';

    return prefix + method + ' '
        + url + ' ' + getResponseStatus(res) + ' (' + time + ')';

}

function logger(options) {
    return function (req, res, next) {
        req._startTime = new Date();

        var rawEnd = res.end;
        res.end = function (chunk, encoding) {
            res.end = rawEnd;
            res.end(chunk, encoding);

            var message = getLogMsg(req, res);
            return process.nextTick(function () {
                return fis.log.info(message);
            });
        };

        return next();
    };
}

module.exports = exports = logger;
