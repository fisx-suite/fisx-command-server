fisx-command-server
========

[![Dependency Status](https://david-dm.org/wuhy/fisx-command-server.svg)](https://david-dm.org/wuhy/fisx-command-server) [![devDependency Status](https://david-dm.org/wuhy/fisx-command-server/dev-status.svg)](https://david-dm.org/wuhy/fisx-command-server#info=devDependencies) [![NPM Version](https://img.shields.io/npm/v/fisx-command-server.svg?style=flat)](https://npmjs.org/package/fisx-command-server)

> Start a local webserver to develop and test.

## How to use

### Start server and debug on soruce

```shell
fisx server start
```

### Start server and debug on release
    
```shell
fisx release 
# fisx release -wL # support live reload
fisx server start --release
```

### Server configure

The server uses [edp-webserver](https://github.com/ecomfe/edp-webserver). The default configure file is `server-conf.js`. The configure informion, please refer to [edp-webserver](https://github.com/ecomfe/edp-webserver).

### Mock configure

The mock uses [autoresponse](https://github.com/wuhy/autoresponse). The mock configure is integrated into `server-conf.js`, if you need to change mock config frequently, you can use the `autoresponse-config.js` configure file. More information, please refer to [autoresponse](https://github.com/wuhy/autoresponse).
