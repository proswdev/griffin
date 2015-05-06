"use strict";

var access = require('./access');
var AclError = require('./acl-error');

module.exports = {
    // getACL is called to extract the granted ACL from the framework specific arguments
    getAcl: function(req/*,res,next*/) {
        // this = required ACL
        return req ? req.acl : null;
    },
    // setACL is called to assign the granted ACL to the framework specific arguments
    setAcl: function(req/*,res,next*/) {
        // this = granted ACL
        req.acl = this;
    },
    // cont is called with the 'access.required' middleware function to continue
    // processing by subsequent middleware since access has been granted.
    cont: function(req,res,next) {
        // this == required ACL
        if (next)
            next();
    },
    // halt is called with the 'access.required' middleware function to halt
    // further processing since access has been denied
    halt: function(req/*,res,next*/) {
        // this == required ACL
        access.denied(req.user ? 403 : 401);
    },
    // accept is called with 'access.requiredFor' target function to notify
    // access has been granted. Typically no processing is required.
    accept: function(req/*,res,next*/) {
        // this == required ACL
    },
    // reject is called with 'access.requiredFor' target function to initiate
    // platform specific processing needed to reject access
    reject: function(req/*,res,next*/) {
        // this == required ACL
        access.denied(req.user ? 403 : 401);
    },
    // The error function is returned with 'access.error' to allow framework specific
    // handling of any errors encountered during access validation, including access
    // being denied.
    error: function(err,req,res,next) {
        if (err instanceof AclError)
            res.status(err.statusCode).send(err.message);
        else
            next(err);
    }
};
