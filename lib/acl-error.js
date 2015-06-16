"use strict";

var util = require('util');

// Define ACL error class derived from base Error class
function AclError(message) {
  Error.call(this);
  this.message = message;
}

util.inherits(AclError, Error);

module.exports = AclError;
