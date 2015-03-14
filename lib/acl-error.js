"use strict";

var util = require('util');

// Define ACL error class derived from base Error class
function AclError(message, status) {
    Error.call(this);
    this.message = message;
    if (status)
        this.statusCode = status;
}

util.inherits(AclError, Error);

module.exports = AclError;
