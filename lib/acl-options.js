"use strict";

var access = require('./access');

module.exports = {
    // errorStatus defines the HTTP status returned when access is denied
    // Typically 403 (forbidden) or 404 (not found)
    errorStatus: 403,
    // getACL is called to extract the granted ACL from the framework specific arguments
    getAcl: function(req) {
        // this = required ACL
        //console.log(arguments.length);
        return req ? req.acl : null;
    },
    // setACL is called to assign the granted ACL to the framework specific arguments
    setAcl: function(req) {
        // this = granted ACL
        req.acl = this;
    },
    // cont is called with the 'access.required' middleware function to continue
    // processing by subsequent middleware since access has been granted
    cont: function(req,res,next) {
        // this == required ACL
        next();
    },
    // halt is called with the 'access.required' middleware function to halt
    // further processing since access has been denied
    halt: function(req,res,next) {
        // this == required ACL
        denied(req,res);
    },
    // accept is called with 'access.requiredFor' when access has been granted and
    // target function is about to be invoked. No processing required for Express
    accept: function(req,res,next) {
        // this == required ACL
    },
    // reject is called with 'access.requiredFor' target function to initiate
    // platform specific processing needed to reject access
    reject: function(req,res,next) {
        // this == required ACL
        denied(req,res);
    }
};

function denied(req,res) {
    if (!req.user)
        // Return 401-Unauthorized for unauthenticated requests
        res.status(401).end();
    else if (access.options.errorStatus === 403)
        // Include basic message for 403-Forbidden
        res.status(403).send('Access denied');
    else
        // Return all other status unchanged (404-Not Found recommended)
        res.status(access.options.errorStatus).end();
}