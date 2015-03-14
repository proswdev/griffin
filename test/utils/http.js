'use strict';

/**
 * Modified version of TJ's http support file from the Express repo:
 * https://github.com/visionmedia/express/blob/master/test/support/http.js
 *
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter,
    should = require('should'),
    methods = ['get','post','put','delete','head'],
    http = require('http'),
    server,
    addr;

exports.createServer = function(app,fn){
    if (server){
        if (fn) {
            return fn();
        } else {
            return;
        }
    }
    app.set('port', process.env.PORT || 3000);
    app.set('host', process.env.HOST || '127.0.0.1');
    server = app.listen(app.get('port'), app.get('host'), function(){
        addr = server.address();
        if (fn)
            fn();
    });
};

exports.request = function() {
    return new Request();
};

function Request() {
    this.data = [];
    this.header = {};
}

/**
 * Inherit from `EventEmitter.prototype`.
 */

Request.prototype.__proto__ = EventEmitter.prototype;

methods.forEach(function(method){
    Request.prototype[method] = function(path){
        return this.request(method, path);
    };
});

Request.prototype.set = function(field, val){
    this.header[field] = val;
    return this;
};

Request.prototype.write = function(data){
    this.data.push(data);
    return this;
};

Request.prototype.request = function(method, path){
    this.method = method;
    this.path = path;
    return this;
};

Request.prototype.expect = function(status, test, fn){
    this.end(function(res){
        if (status) {
            res.statusCode.should.equal(status);
        }
        if (test instanceof RegExp) {
            res.body.should.match(test);
        } else if (test instanceof Function) {
            test(res);
        } else if (test) {
            res.body.should.equal(test);
        }
        if (fn)
            fn();
    });
};

Request.prototype.end = function(fn){

    var req = http.request({
        method: this.method,
        port: addr.port,
        host: addr.address,
        path: this.path,
        headers: this.header
    });

    this.data.forEach(function(chunk){
        req.write(chunk);
    });

    req.on('response', function(res){
        var buf = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk){ buf += chunk });
        res.on('end', function(){
            res.body = buf;
            fn(res);
        });
    });

    req.end();

    return this;
};
