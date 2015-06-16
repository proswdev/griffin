"use strict";

var access = require('./access');
var Acl = require('./acl');

function AclBuilder() {

  var _acl = new Acl();
  var _resources = null;
  var _actions = null;
  var _builder = null;
  var _stack = [];
  var _lastToken = null;
  var _add = true;

  function select(nextToken) {
    // Process state change if token changed and processing not
    // delegated to a nested ACL builder
    if (!_builder && _lastToken !== nextToken) {
      // Except clause meaningful with roles only
      if (nextToken === 'except' && _lastToken !== 'role')
        access._throw("'except' applies to roles only");
      var next = false;
      switch (_lastToken) {
        case 'resource':
          // Resource tokens need always be followed by action token(s)
          if (nextToken !== 'action')
            access._throw('Resource(s) specified without action(s)');
          break;
        case 'action':
          // All resource(s) and action(s) have been specified to create new
          // set of permissions. Collect all permissions into a single ACL.
          var acl = new Acl();
          _resources.forEach(function(resource) {
            acl.add(new Acl(resource, _actions));
          });
          // Update stack with new ACL
          if (_stack.length > 0)
            _stack[0].add(acl);
          else
            _stack.push(acl);
          if (nextToken === 'resource') {
            // Start new set of permissions
            _resources = [];
            _actions = [];
          } else {
            // Next token doesn't refer to permissions
            _resources = _actions = null;
            next = true;
          }
          break;
        default:
          // Action tokens can only be preceded by resource tokens
          if (nextToken === 'action')
            access._throw('Action(s) specified without resource');
          next = _stack.length > 0;
          break;
      }
      // Route all subsequent tokens to a nested ACL builder if applicable
      if (nextToken && next)
        _builder = new AclBuilder();
      // Register last token processed by this ACL instance
      _lastToken = next ? null : nextToken;
    }
  }

  this.addResources = function(resources) {
    // Update state machine
    select('resource');
    if (_builder) {
      // Delegate resources to nested ACL builder
      _builder.addResources(resources);
    } else {
      // Add resource(s) to pending resource list
      _resources = _resources || [];
      access._makeArray(resources).forEach(function(resource) {
        _resources.push(resource);
      });
    }
  };

  this.addActions = function(actions) {
    // Update state machine
    select('action');
    if (_builder) {
      // Delegate actions to nested ACL builder
      _builder.addActions(actions);
    } else {
      // Add actions to pending actions list
      _actions = _actions || [];
      access._makeArray(actions).forEach(function(action) {
        _actions.push(action);
      });
    }
  };

  this.addRoles = function(roles) {
    // Update state machine
    select('role');
    if (_builder) {
      // Delegate roles to nested ACL builder
      _builder.addRoles(roles);
    } else {
      // Add roles directly to ACL stack
      access._makeArray(roles).forEach(function(role) {
        _stack.push(new Acl(role));
      });
    }
  };

  this.except = function() {
    if (!_builder) {
      // Update state machine and switch this instance
      // to subtractive mode
      select('except');
      _add = false;
    } else {
      // Delegate token to nested ACL builder
      _builder.except();
    }
  };

  this.nextAcl = function() {
    // Build ACL from current stack content and clear stack
    // for more definitions that will follow
    this.build();
    _stack = [];
  };

  this.build = function() {
    // Update state machine
    select(null);
    if (_builder) {
      // Have nested builder produce an ACL and combine
      // results with ACLs on the stack for this instance
      var rightAcl = _builder.build();
      _stack.forEach(function(leftAcl) {
        if (_add)
          leftAcl.add(rightAcl);
        else
          leftAcl.remove(rightAcl);
      });
      _builder = null;
    }
    // Collect all ACLs on the stack into a single ACL
    var acl = _stack[0];
    var len = _stack.length;
    for (var i = 1; i < len; i++)
      acl.add(_stack[i]);
    // Combine resulting ACL with other ACLs already created
    // by this builder instance
    _acl.combine(acl);
    _stack = null;
    return _acl;
  }
}

module.exports = AclBuilder;
