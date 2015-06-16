"use strict";

var access = require('./access');

module.exports = {
  // errorStatus and errorMessage define the HTTP status and message returned when access is denied
  // It is recommended to use 403 (forbidden) when a failure message is available or 404 (not found)
  // when errorMessage is left empty in case server does not wish to provide more info about failure
  errorStatus: 403,
  errorMessage: "Access denied",
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
  // reject is called with 'access.requiredFor' to perform framework specific
  // processing when access to the target function has been denied
  reject: function(req,res,next) {
    // this == required ACL
    denied(req,res);
  }
};

function denied(req,res) {
  if (access.options.errorMessage)
    res.status(access.options.errorStatus).send(access.options.errorMessage);
  else
    res.status(access.options.errorStatus).end();
}