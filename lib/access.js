"use strict";

var AclError = require('./acl-error');

// Add Array.forEach support for older javascript versions
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(fun /*, thisp*/) {
        var len = this.length;
        if (typeof fun != "function")
            throw new TypeError();
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
            if (i in this)
                fun.call(thisp, this[i], i, this);
        }
    };
}

var _accessDefs = {};
var _acid = 0;
var _aclBuilder;
var _wildRoles = [];

var _access = {

    getAcl: function() {
        // Build and return ACL currently under construction
        if (_aclBuilder) {
            var acl = _aclBuilder.build();
                _aclBuilder = null;
        }
        return acl;
    },

    eval: function(aclstr) {
        var dummy;
        // Evaluate all elements specified in ACL string using dot notation
        aclstr.split('.').forEach(function(item){
            if (Object.getOwnPropertyDescriptor(_access, item))
                dummy = _access[item];
            else
                dummy = access._throw("'" + item + "' not defined", 500);
        });
        return _access;
    },

    get and() {
        // AND keyword does nothing
        return _access;
    },

    get or() {
        // OR keyword adds another ACL
        _aclBuilder.nextAcl();
        return _access;
    },

    get except() {
        // Toggle add/remove mode for ACL builder
        _aclBuilder.except();
        return _access;
    },

    get required() {
        // Complete current ACL and pass on 'required' operation
        var acl = _access.getAcl();
        return acl.required;
    },

    grantTo: function() {
        // Complete current ACL and pass on assignment operation
        // with full unaltered argument list
        var acl = _access.getAcl();
        acl.grantTo.apply(acl, arguments);
    },

    requiredFor: function() {
        // Complete current ACL and pass on 'requiredFor' operation
        // with full unaltered argument list
        var acl = _access.getAcl();
        return acl.requiredFor.apply(acl, arguments);
    },

    isGrantedTo: function() {
        // Complete current ACL and pass on 'requiredFor' operation
        // with full unaltered argument list
        var acl = _access.getAcl();
        return acl.isGrantedTo.apply(acl, arguments);
    }
};

var access = {
    define: function(accessDefs) {
        _defineAccess(accessDefs);
        // Recompile wildcards after definition update
        _wildRoles.forEach(function(role){
            _accessDefs[role]._acl = _compile(_accessDefs[role]._wildDefs);
        });
    },
    eval: function(aclstr) {
        // Create new ACL builder and construct ACL from string
        _aclBuilder = new AclBuilder();
        return _access.eval(aclstr);
    },
    isResource: function(name) {
        // Resources do not have an access ID while roles do
        var accessDef = _accessDefs[name];
        return accessDef !== undefined && accessDef._acid === undefined;
    },
    isRole: function(name) {
        // Resources do not have an access ID while roles do
        var accessDef = _accessDefs[name];
        return accessDef !== undefined && accessDef._acid !== undefined;
    },
    lock: function() {
        // Remove define related methods and variables
        _wildRoles.forEach(function(role) {
            delete _accessDefs[role]._wildDefs;
        });
        _wildRoles = null;
        delete access.define;

        // Freeze all access
        Object.freeze(access);
        Object.freeze(_access);
    },
    denied: function(status) {
        access._throw('Access denied', status || 403);
    },
    get error() {
        return Acl.options.error;
    },
    get options() {
        return Acl.options;
    },
    set options(newOptions) {
        // Replace existing options with any specified new ones
        var oldOptions = Acl.options;
        for (var option in newOptions) {
            if (Object.getOwnPropertyDescriptor(oldOptions, option))
                oldOptions[option] = newOptions[option];
        }
    },
    _getAcid: function(name,action) {
        // Return assigned access id if name identifies a role or
        // if name + action identifies a valid permission
        return _accessDefs[name]._acid || _accessDefs[name][action];
    },
    _getAcidName: function(acid) {
        // Locate access definition by id
        for (var name in _accessDefs) {
            var accessDef = _accessDefs[name];
            // Try locating role with specified access id
            if (accessDef._acid === acid)
                return name;
            if (!accessDef._acid) {
                // Locate resource.action permission by id otherwise
                for (var action in accessDef)
                    if (accessDef[action] === acid)
                        return name + '.' + action;
            }
        }
    },
    _getAcl: function(role) {
        return _accessDefs[role]._acl;
    },
    _throw: function(message, status) {
        throw new AclError('Access invalid - ' + message + '!', status);
    },
    _makeArray: function(arg) {
        // Convert obj into [obj] or 'a,b,c' into ['a','b','c']
        if (arg) {
            if (typeof(arg) === "string")
                arg = arg.split(',');
            else if (!Array.isArray(arg))
                arg = [arg];
        }
        return arg;
    }
};

// Create list of reserved property and method names already in use by the access classes
var _reserved = Object.getOwnPropertyNames(_access).concat(Object.getOwnPropertyNames(access));
module.exports = access;

var AclBuilder = require('./acl-builder');
var Acl = require('./acl');

function _validate(name) {
    // Make sure specified name is not in the reserved names list
    if (_reserved.indexOf(name) >= 0)
        access._throw("'" + name + "' is a reserved word", 500);
}

function _defineAccess(accessDefs) {
    var wild = false;
    access._makeArray(accessDefs).forEach(function(accessDef) {
        if (Array.isArray(accessDef)) {
            // Define access recursively
            if (_defineAccess(accessDef))
                wild = true;
        } else if (_isWild(accessDef)) {
            wild = true;
        } else {
            if (accessDef.resource) {
                // Define permission(s) from specified resource(s) and action(s)
                accessDef.resource.split(',').forEach(function(resource) {
                    _definePermission(resource, accessDef.action);
                });
            } else {
                // Define roles(s)
                accessDef.role.split(',').forEach(function (role) {
                    _defineRole(role, accessDef.access);
                });
            }
        }
    });
    return wild;
}

function _definePermission(name, actions) {
    // Validate resource name
    if (!name)
        access._throw('no resource name specified', 500);
    _validate(name);
    if (access.isRole(name))
        access._throw("'" + name + "' already defined as role", 500);

    if (!Object.getOwnPropertyDescriptor(access, name)) {
        // Define resource as read-only property on main access object
        Object.defineProperty(access, name, (function() {
            var __resource = name;
            return {
                get: function() {
                    _aclBuilder = new AclBuilder();
                    return _access[__resource];
                }
            }
        })());
        // Define resource as read-only property on access helper object
        Object.defineProperty(_access, name, (function() {
            var __resource = name;
            return {
                get: function() {
                    _aclBuilder.addResources(__resource);
                    return _access;
                }
            }
        })());
    }

    // Permission definitions require a resource + action(s)
    if (!actions)
        access._throw("Resource '" + name + "' specified without any actions", 500);

    // Define action(s) as read-only properties on access helper object
    var accessDef = _accessDefs[name] || {};
    access._makeArray(actions).forEach(function(action) {
        // Validate action name
        _validate(action);
        if (accessDef[action] === undefined) {
            // Assign next access id to action
            accessDef[action] = ++_acid;
            if (!Object.getOwnPropertyDescriptor(_access, action)) {
                Object.defineProperty(_access, action, (function() {
                    var __action = action;
                    return {
                        get: function() {
                            _aclBuilder.addActions(__action);
                            return _access;
                        }
                    }
                })());
            }
        }
    });
    _accessDefs[name] = accessDef;
}

function _defineRole(name, accessDef) {
    var acl;
    // Validate role name
    if (!name)
        access._throw('no role name specified', 500);
    _validate(name);
    if (access.isResource(name))
        access._throw("'" + name + "' already defined as resource", 500);

    if (!Object.getOwnPropertyDescriptor(access, name)) {
        // Define role as read-only property on main access object
        Object.defineProperty(access, name, (function() {
            var __role = name;
            return {
                get: function() {
                    _aclBuilder = new AclBuilder();
                    return _access[__role];
                }
            }
        })());
        // Define role as read-only property on access helper object
        Object.defineProperty(_access, name, (function() {
            var __role = name;
            return {
                get: function() {
                    _aclBuilder.addRoles(__role);
                    return _access;
                }
            }
        })());
    }
    // Assign next access id to role
    if (!_accessDefs[name])
        _accessDefs[name] = { _acid: ++_acid };

    // Roles may be associated with a set of permissions (optional), where
    // permissions are either specified as an ACL string or as a recursive
    // ACL definition object
    if (accessDef) {
        var wild = false;
        if (typeof accessDef !== 'string') {
            wild = _defineAccess(accessDef);
            _accessDefs[name]._acl = _compile(accessDef);
        } else if (_isWild(accessDef)) {
            _accessDefs[name]._acl = _compile(accessDef);
            wild = true;
        } else {
            acl = new Acl();
            acl.add(access.eval(accessDef).getAcl());
            _accessDefs[name]._acl = acl;
        }
        if (wild) {
            _accessDefs[name]._wildDefs = _copyDef(accessDef);
            _wildRoles.push(name);
        }
    }
}

function _compile(accessDefs) {

    var acl,aclBuilder,dummy;

    // Save current ACL builder and create new instance
    aclBuilder = _aclBuilder;
    _aclBuilder = new AclBuilder();

    // Compile a new ACL from specified access definitions
    if (Array.isArray(accessDefs) && Array.isArray(accessDefs[0])) {
        // Compile nested ACL definitions recursively into a combined ACL
        acl = new Acl();
        accessDefs.forEach(function (accessDef) {
            acl.combine(_compile(accessDef));
        });
    } else if (typeof(accessDefs) === 'string' && _isWild(accessDefs)) {
        acl = new Acl(1, _acid);
    } else {
        access._makeArray(accessDefs).forEach(function(accessDef){
            var name;
            if (accessDef.resource) {
                var resources = accessDef.resource;
                if (_isWild(resources)) {
                    resources = [];
                    for (name in _accessDefs) {
                        if (access.isResource(name))
                            resources.push(name);
                    }
                }
                // Compile resources and actions
                access._makeArray(resources).forEach(function(resource){
                    var actions = accessDef.action;
                    if (!actions || _isWild(actions)) {
                        actions = [];
                        for (var action in _accessDefs[resource])
                            actions.push(action);
                    }
                    access._makeArray(actions).forEach(function(action){
                        if (_accessDefs[resource][action]) {
                            dummy = _access[resource];
                            dummy = _access[action];
                        }
                    });
                });
            } else if (accessDef.role) {
                var roles = accessDef.role;
                if (_isWild(roles)) {
                    roles = [];
                    for (name in _accessDefs) {
                        if (access.isRole(name))
                            roles.push(name);
                    }
                }
                // Compile roles
                access._makeArray(roles).forEach(function(role) {
                    dummy = _access[role];
                });
            }
        });
        // Build ACL from results
        acl = _access.getAcl();
    }

    // Restore saved ACL builder
    _aclBuilder = aclBuilder;

    return acl;
}

function _isWild(data) {
    var isWild = false;
    if (typeof data === 'string')
        isWild = data === '*';
    else if (typeof data === 'object')
        isWild = _isWild(data.resource) || _isWild(data.action) || _isWild(data.role);
    return isWild;
}

function _copyDef(accessDef) {
    var copy;
    if (Array.isArray((accessDef))) {
        copy = [];
        accessDef.forEach(function(def) {
            copy.push(_copyDef(def));
        });
    } else if (typeof(accessDef) === 'string') {
        copy = accessDef;
    } else {
        copy = accessDef.constructor();
        for (var key in accessDef) {
            if(accessDef.hasOwnProperty(key)) {
                copy[key] = accessDef[key];
            }
        }
    }
    return copy;
}
