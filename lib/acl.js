"use strict";

var access = require('./access');
var AclMask = require('./acl-mask');
var options = require('./acl-options');

function Acl(name, actions) {

    var self = this;

    // An ACL either contains a single access mask or a list of nested ACLs
    // (but not both)

    function unique(acls) {
        var newAcls = [];
        // Remove empty and duplicate ACLs from specified list
        acls.forEach(function(acl) {
            if (!acl.isEmpty()) {
                var found = false;
                var len = newAcls.length;
                for (var i = 0; !found && i < len; i++)
                    found = newAcls[i].equals(acl);
                if (!found)
                    newAcls.push(acl);
            }
        });
        return newAcls;
    }

    function minimize(acl) {
        // Consider masks that form a super set of other masks redundant and
        // remove them to produce a minimized ACL list
        if (acl.acls && !acl.minimized) {
            if (acl.maximized)
                access._throw('Acl is either required or granted but not both', 500);
            optimize(acl,false);
            acl.minimized = true;
        }
    }

    function maximize(acl) {
        // Consider masks that form a sub set of other masks redundant and
        // remove them to produce a maximized ACL list
        if (acl.acls && !acl.maximized) {
            if (acl.minimized)
                access._throw('Acl is either required or granted but not both', 500);
            optimize(acl,true);
            acl.maximized = true;
        }
    }

    function optimize(acl, max) {
        var acls = acl.acls,
            changed = false;
        // Optimize ACL list by removing redundant masks. A mask is considered redundant if
        // it forms a super set or a sub set of other masks in the list, depending on the
        // value of the max parameter
        acls.forEach(function(acl1) {
            if (acl1 && acl1.mask) {
                acls.forEach(function(acl2,index2) {
                    if (acl2 && acl1 !== acl2 && acl2.mask) {
                        var redundant = max ? acl1.mask.contains(acl2.mask) : acl2.mask.contains(acl1.mask);
                        if (redundant) {
                            acls[index2] = undefined;
                            changed = true;
                        }
                    }
                });
            }
        });
        if (changed) {
            // Compact list by removing redundant items
            var newAcls = [];
            acls.forEach(function(acl1){
                if (acl1)
                    newAcls.push(acl1);
            });
            acl.acls = newAcls;
        }
    }

    function isAllowed(requiredAcl, grantedAcl) {
        var i, len, allowed = false;
        // Compare required mask/ACLs against granted mask/ACLs
        if (requiredAcl.mask && grantedAcl.mask) {
            allowed = grantedAcl.mask.contains(requiredAcl.mask);
        } else if (requiredAcl.mask && grantedAcl.acls) {
            len = grantedAcl.acls.length;
            for (i = 0; !allowed && i < len; i++)
                allowed = isAllowed(requiredAcl, grantedAcl.acls[i]);
        } else if (requiredAcl.acls) {
            len = requiredAcl.acls.length;
            for (i = 0; !allowed && i < len; i++)
                allowed = isAllowed(requiredAcl.acls[i], grantedAcl);
        } else {
            allowed = !requiredAcl.mask || requiredAcl.mask.isEmpty();
        }
        return allowed;
    }

    this.add = function(acl) {
        var leftAcls;
        if (self.mask && acl.mask) {
            // Add specified ACL mask to this mask
            self.mask.set(acl.mask);
        } else if (self.mask && acl.acls) {
            // Convert mask to list by adding this mask
            // to each item in list from specified ACL
            leftAcls = [];
            acl.acls.forEach(function(rightAcl) {
                var leftAcl = self.clone();
                leftAcl.add(rightAcl);
                leftAcls.push(leftAcl);
            });
            self.acls = leftAcls;
            delete self.mask;
        } else if (self.acls && acl.mask) {
            // Add specified ACL mask to each item in this ACL list
            self.acls.forEach(function(leftAcl) {
                leftAcl.add(acl);
            });
        } else if (self.acls && acl.acls) {
            // Create new ACL list by adding each item in list
            // from specified ACL to each item in this list
            leftAcls = [];
            self.acls.forEach(function(leftAcl){
                acl.acls.forEach(function(rightAcl){
                    var newAcl = leftAcl.clone();
                    newAcl.add(rightAcl);
                    leftAcls.push(newAcl);
                });
            });
            self.acls = leftAcls;
        } else if (acl.mask) {
            // Copy mask from specified ACL
            self.mask = acl.mask;
        } else if (acl.acls) {
            // Copy list from specified ACL
            self.acls = acl.acls;
        }
        // Remove duplicates from updated ACL list
        if (self.acls)
            self.acls = unique(self.acls);
    };

    this.remove = function(acl) {
        var leftAcls;
        if (self.mask && acl.mask) {
            // Remove specified ACL mask from this mask
            self.mask.reset(acl.mask);
        } else if (self.mask && acl.acls) {
            // Convert mask to list by removing this mask
            // from each item in list from specified ACL
            leftAcls = [];
            acl.acls.forEach(function(rightAcl) {
                var leftAcl = self.clone();
                leftAcl.remove(rightAcl);
                leftAcls.push(leftAcl);
            });
            self.acls = leftAcls;
            delete self.mask;
        } else if (self.acls && acl.mask) {
            // Remove specified ACL mask from each item in this ACL list
            self.acls.forEach(function(leftAcl) {
                leftAcl.remove(acl);
            });
        } else if (self.acls && acl.acls) {
            // Create new ACL list by removing each item in list
            // from specified ACL from each item in this list
            leftAcls = [];
            self.acls.forEach(function(leftAcl){
                acl.acls.forEach(function(rightAcl){
                    var newAcl = leftAcl.clone();
                    newAcl.remove(rightAcl);
                    leftAcls.push(newAcl);
                });
            });
            self.acls = leftAcls;
        }
        // Remove duplicates from updated ACL list
        if (self.acls)
            self.acls = unique(self.acls);
    };

    this.combine = function(acl) {
        var newAcl;
        if (self.mask && (acl.mask || acl.acls)) {
            // Convert single mask to nested ACL list
            newAcl = new Acl();
            newAcl.mask = self.mask;
            self.acls = [newAcl];
            delete self.mask;
        }
        if (self.acls) {
            if (acl.mask) {
                // Add mask from specified ACL as nested ACL
                // to the list of this ACL
                newAcl = new Acl();
                newAcl.mask = acl.mask;
                self.acls.push(newAcl);
            } else if (acl.acls) {
                // Append list of specified ACL to list of this ACL
                acl.acls.forEach(function(rightAcl) {
                    self.acls.push(rightAcl);
                });
            }
            // Remove duplicates from updated ACL list
            if (self.acls.length > 0)
                self.acls = unique(self.acls);
        } else if (acl.mask) {
            // Copy mask from specified ACL
            self.mask = acl.mask;
        } else if (acl.acls) {
            // Copy ACL list from specified ACL
            self.acls = acl.acls;
        }
    };

    this.filter = function(granted, options) {
        var acls,mask;
        // Filter mask/ACLs of this ACL with mask/ACLs of specified ACL
        if (self.mask && granted.mask) {
            self.mask.filter(granted.mask);
            if (options && options.rolesOnly) {
                mask = new AclMask();
                self.mask.forEach(function(bit) {
                    if (access.isRole(access._getAcidName(bit)))
                        mask.set(bit);
                });
                self.mask = mask;
            }
        } else if (self.mask && granted.acls) {
            acls = [];
            granted.acls.forEach(function(acl) {
                var thisAcl = self.clone();
                thisAcl.filter(acl, options);
                acls.push(thisAcl);
            });
            self.acls = acls;
            delete self.mask;
        } else if (self.acls) {
            acls = [];
            self.acls.forEach(function(acl) {
                acl.filter(granted, options);
                if (acl.mask)
                    acls.push(acl);
                else if (acl.acls)
                    acls = acls.concat(acl.acls);
            });
            self.acls = acls;
        } else  if (self.mask) {
            delete self.mask;
        }
        // Remove duplicates from updated ACL list
        if (self.acls) {
            self.acls = unique(self.acls);
            maximize(self);
        }
    };

    this.equals = function(acl) {
        var i, len, equal;
        if (self.mask && acl.mask) {
            // ACls are equal if both have identical masks
            equal = self.mask.equals(acl.mask);
        } else if (self.acls && acl.acls) {
            // ACls are equal if both have same list with identical ACLs
            len = self.acls.length;
            equal = len === acl.acls.length;
            for (i = 0; equal && i < len; i++)
                equal = self.acls[i].equals(acl.acls[i]);
        } else {
            equal = !self.mask && !self.acls && !acl.mask && !acl.acls;
        }
        return equal;
    };

    this.toString = function() {
        var items = [];
        if (this.mask) {
            // Convert mask to array string of corresponding acid names
            this.mask.forEach(function(acid) {
                items.push(access._getAcidName(acid));
            });
            items = '[' + items + ']';
        } else if (this.acls) {
            // Convert ACLs to combined list of mask strings
            this.acls.forEach(function(acl) {
                items.push(acl.toString());
            });
            if (items.length > 1)
                items = items.join(' || ');
        }
        return items.toString();
    };

    this.clone = function() {
        var copy = new Acl();
        if (self.mask) {
            copy.mask = self.mask.clone();
        } else if (self.acls) {
            copy.acls = [];
            self.acls.forEach(function(acl) {
                copy.acls.push(acl.clone());
            });
        }
        return copy;
    };

    this.isEmpty = function() {
        var i,len,empty = true;
        if (self.mask) {
            empty = self.mask.isEmpty();
        } else if (self.acls) {
            len = self.acls.length;
            for (i = 0; empty && i < len; i++)
                empty = self.acls[i].isEmpty();
        }
        return empty;
    };

    this.isGrantedTo = function(arg) {
        var allowed = true;
        if (arg) {
            // Delegate retrieval of granted ACL from framework specific arguments to external option method
            var grantedAcl = arg instanceof Acl ? arg : (options.getAcl.apply(this, arguments) || new Acl());
            if (grantedAcl)
                allowed = isAllowed(this, grantedAcl);
        }
        return allowed;
    };

    this.grantTo = function() {
        // Optimize this instance for use as granted ACL
        maximize(this);
        // Delegate ACL assignment to framework specific arguments to external option method
        options.setAcl.apply(this, arguments);
    };

    this.requiredFor = function(arg) {
        // Optimize this instance for use as required ACL
        minimize(this);
        if (typeof arg === 'function') {
            // Overload specified function through closure to perform
            // authorization before actual target function is invoked
            return (function() {
                var __acl = self;
                var __fnc = arg;
                return function() {
                    // Process framework specific arguments to validate access
                    var allowed = __acl.isGrantedTo.apply(__acl, arguments);
                    if (allowed) {
                        // Delegate framework specific acceptance to external option method
                        // and invoke target function with unaltered arguments
                        options.accept.apply(__acl, arguments);
                        __fnc.apply(__acl, arguments);
                    } else {
                        // Delegate framework specific rejection to external option method
                        options.reject.apply(__acl, arguments);
                    }
                };
            })();
        } else {
            // Process framework specific arguments to validate access and
            // delegate acceptance/rejection to external option methods
            var allowed = self.isGrantedTo.apply(self, arguments);
            if (allowed)
                options.accept.apply(self, arguments);
            else
                options.reject.apply(self, arguments);
        }
    };

    Object.defineProperty(this, 'required', (function() {
        var __acl = self;
        return {
            get: function() {
                // Optimize this instance for use as required ACL
                minimize(this);
                // Return function designed for middleware to handle access control
                return function() {
                    // Process framework specific arguments to validate access and
                    // delegate continuation/halting by middleware function to
                    // external options methods
                    var allowed = __acl.isGrantedTo.apply(__acl, arguments);
                    if (allowed)
                        options.cont.apply(__acl, arguments);
                    else
                        options.halt.apply(__acl, arguments);
                };
            }
        }
    })());

    if (typeof(name) === 'number' && typeof(actions) === 'number') {
        // ACL represents roles and permissions within specified acid range
        self.mask = new AclMask();
        for (var i = name; i <= actions; i++)
            self.mask.set(i);
    } else if (actions) {
        // ACL represents one or more permissions (resource(s) + action(s))
        if (!access.isResource(name))
            access._throw("'" + name + "' is not a valid resource", 500);
        self.mask = new AclMask();
        access._makeArray(actions).forEach(function(action) {
            var acid = access._getAcid(name, action);
            if (acid === undefined)
                access._throw("Action '" + action + "' not defined for resource '" + name + "'", 500);
            self.mask.set(acid);
        });
    } else if (name && access.isRole(name)) {
        // ACL represents one or more roles
        var acid = access._getAcid(name);
        self.mask = new AclMask(acid);
        var acl = access._getAcl(name);
        if (acl)
            self.add(acl);
    } else if (name) {
        access._throw("'" + name + "' is not a valid role", 500);
    }
}

Acl.options = options;

module.exports = Acl;
