"use strict";

// Although AclMask is representing something similar to a bit mask as typically used with languages such
// as C/C++ to implement efficient bit manipulation, true bit masks are actually not very efficient in
// javascript since each mask operation requires multiple conversions from numbers to integers and back.
// No profiling has been performed yet to compare performance with true bit masks but the current AclMask
// implementation uses arrays to represent a sequence of bits. Depending on the bit mask operation being
// performed, an AclMask instance is either represented as a bit mask array where index represents bit
// position and value is true to indicate bit is set or false/undefined if bit is reset, or as a bit list
// where the array lists the bit numbers of all bits set.

function AclMask(mask) {
  this.mask = [];
  if (mask !== undefined)
    this.set(mask);
}

AclMask.prototype.set = function(mask) {
  var thisMask = this.getBitMask();
  if (typeof mask === 'number') {
    thisMask[mask] = true;
  } else {
    mask.forEach(function(bit) {
      thisMask[bit] = true;
    });
  }
};

AclMask.prototype.reset = function(mask) {
  var thisMask = this.getBitMask();
  if (typeof mask === 'number') {
    if (thisMask[mask])
      thisMask[mask] = undefined;
  } else {
    mask.forEach(function(bit) {
      if (thisMask[bit])
        thisMask[bit] = undefined;
    });
  }
};

AclMask.prototype.filter = function(mask) {
  var thisMask = this.getBitMask(),
    thatMask = mask.getBitMask();
  this.forEach(function(bit) {
    if (!thatMask[bit])
      thisMask[bit] = undefined;
  });
};

AclMask.prototype.equals = function(mask) {
  var thisMask = this.getBitMask(),
    thatMask = mask.getBitMask(),
    count = Math.max(thisMask.length, thatMask.length),
    i, equal;
  for (i = 0, equal = true; equal && i < count; i++)
    equal = thisMask[i] === thatMask[i];
  return equal;
};

AclMask.prototype.contains = function(mask) {
  var thisMask = this.getBitMask(),
    thatList = mask.getBitList(),
    count = thatList.length,
    set = count > 0,
    i;
  for (i = 0; set && i < count; i++)
    set = thisMask[thatList[i]];
  return !!set;
};

AclMask.prototype.isEmpty = function() {
  return this.getBitList().length == 0;
};

AclMask.prototype.clone = function() {
  var copy = new AclMask();
  if (this.mask)
    copy.mask = this.mask.slice(0);
  else if (this.list)
    copy.list = this.list.slice(0);
  return copy;
};

AclMask.prototype.forEach = function(cb) {
  if (this.mask) {
    this.mask.forEach(function(set, bit) {
      if (set)
        cb(bit);
    });
  } else if (this.list) {
    this.list.forEach(function(bit) {
      cb(bit);
    });
  }
};

AclMask.prototype.getBitMask = function() {
  if (!this.mask) {
    var mask = [];
    if (this.list) {
      this.list.forEach(function(bit) {
        mask[bit] = true;
      });
      delete this.list;
    }
    this.mask = mask;
  }
  return this.mask;
};

AclMask.prototype.getBitList = function() {
  if (!this.list) {
    var list = [];
    if (this.mask) {
      this.forEach(function(bit){
        list.push(bit);
      });
      delete this.mask;
    }
    this.list = list;
  }
  return this.list;
};

module.exports = AclMask;
