'use strict';

var should = require('should');
var async = require('async');
var access = require('../index');
var Acl = require('../lib/acl');

describe("Access", function() {

  function verifyAccessDef(accessList) {
    access._makeArray(accessList).forEach(function(item) {
      if (Array.isArray(item)) {
        verifyAccessDef(item);
      } else if (item.resource) {
        item.resource.split(',').forEach(function(resource) {
          access.should.have.property(resource);
          if (item.action) {
            item.action.split(',').forEach(function(action) {
              access[resource].should.have.property(action);
            });
          }
        });
      } else {
        item.role.split(',').forEach(function(role) {
          access.should.have.property(role);
        });
        if (item.access && typeof item.access !== 'string')
          verifyAccessDef(item.access);
      }
    });
  }

  function verifyAccess(_access, includes, excludes) {
    var i,len,acl,acls;

    if (typeof _access === 'string') {
      acls = _access.split(' || ');
    } else {
      if (!(_access instanceof Acl))
        _access = _access.getAcl();
      acls = _access.toString().split(' || ');
    }

    if (includes && typeof includes === 'string')
      includes = [ includes ];
    len = includes ? includes.length : 0;
    if (includes)
      acls.length.should.equal(len);
    for (i = 0; i < len; i++) {
      var include = includes[i].split(',');
      if (acls[i][0] == '[')
        acl = acls[i].substr(1, acls[i].length-2).split(',');
      else
        acl = acls[i].split(',');
      acl.length.should.equal(include.length);
      include.forEach(function(item) {
        acl.indexOf(item).should.be.above(-1);
      });
    }

    if (excludes && typeof excludes === 'string')
      excludes = [ excludes ];
    len = excludes ? excludes.length : 0;
    if (excludes)
      acls.length.should.equal(len);
    for (i = 0; i < len; i++) {
      var exclude = excludes[i].split(',');
      if (acls[i][0] == '[')
        acl = acls[i].substr(1, acls[i].length-2).split(',');
      else
        acl = acls[i].split(',');
      exclude.forEach(function(item) {
        acl.indexOf(item).should.be.below(0);
      });
    }
  }

  var accessList = [
    { resource: 'Book', action: 'read,write' },
    { resource: 'Letter', action: 'write,send' },
    { resource: 'Music', action: 'listen' },
    { role: 'Reader', access: [
      { resource: 'Book,Letter', action: 'read' },
      { resource: 'Book', action: 'browse' }
    ]},
    { role: 'Writer', access: [
      { role: 'Author', access: { resource: 'Book', action: 'read,write,edit' } },
      { role: 'Composer', access: { resource: 'Song', action: 'compose' } },
      { resource: 'Letter', action: 'send' }
    ]},
    { role: 'Reviewer', access : [
      [ { role: 'Reader' }, { resource: 'Book', action: 'edit' }],
      [ { role: 'Listener', access: 'Music.listen' }],
      [ { role: 'Author' } ]
    ]},
    { role: 'Reviewer2', access: 'Reader.Book.edit.or.Listener.or.Author' }
  ];
  var addResource = { resource: 'Sign', action: 'read,follow' };
  var extentResource = { resource: 'Song', action: 'play,listen' };
  var addRole = { role: 'Sender', access: { resource: 'Letter', action: 'write,send,post' }};
  var allRead = { role: 'AllRead', access: [
    { resource: '*', action: 'read' },
    { resource: 'Music', action: 'listen' }
  ]};
  var allBook = { role: 'AllBook', access: { resource: 'Book', action: '*'} };
  var allRoles = { role: 'AllRoles', access: { role: '*'}};
  var allResources = { role: 'AllResources', access: { resource: '*' }};
  var allAccess = { role: 'AllAccess', access: '*' };
  var extra = { role: 'Extra', access: [
    { resource: 'Mind', action: 'read'},
    { resource: 'Book', action: 'scan'}
  ]};

  it ('should be able to create resources, actions and roles', function(done) {
    access.define(accessList);
    verifyAccessDef(accessList);
    done();
  });

  it ('should be able to add resources', function(done) {
    access.define(addResource);
    accessList.push(addResource);
    verifyAccessDef(accessList);
    done();
  });

  it ('should be able to extent existing resources', function(done) {
    access.define(extentResource);
    accessList.push(extentResource);
    verifyAccessDef(accessList);
    done();
  });

  it ('should be able to add roles', function(done) {
    access.define(addRole);
    accessList.push(addRole);
    verifyAccessDef(accessList);
    done();
  });

  it ('Wildcard resources should assign all applicable resources to role', function(done){
    access.define(allRead);
    verifyAccess(access.AllRead,
      "AllRead,Book.read,Letter.read,Sign.read,Music.listen"
    );
    done();
  });

  it ('Wildcard actions should assign full resource access to role', function(done){
    access.define(allBook);
    verifyAccess(access.AllBook,
      "AllBook,Book.read,Book.write,Book.browse,Book.edit"
    );
    done();
  });

  it ('Wildcard roles should assign all existing roles to a new role', function(done) {
    access.define(allRoles);
    verifyAccess(access.AllRoles,
      "Reader,Book.read,Letter.read,Book.browse," +
      "Writer,Author,Book.write,Book.edit," +
      "Composer,Song.compose,Letter.send," +
      "Reviewer,Listener,Music.listen,Reviewer2," +
      "Sender,Letter.write,Letter.post," +
      "AllRead,Sign.read," +
      "AllBook,AllRoles"
    );
    done();
  });

  it ('Wildcard resources and actions should assign full access to all resources', function(done){
    access.define(allResources);
    verifyAccess(access.AllResources,
      "AllResources," +
      "Book.read,Book.write,Book.browse,Book.edit," +
      "Letter.read,Letter.write,Letter.send,Letter.post," +
      "Song.compose,Song.play,Song.listen," +
      "Sign.read,Sign.follow," +
      "Music.listen"
    );
    done();
  });

  it ('Wildcard access should assign full access to all resources and roles', function(done) {
    access.define(allAccess);
    verifyAccess(access.AllAccess,
      "Book.read,Book.write,Book.browse,Book.edit," +
      "Letter.read,Letter.write,Letter.send,Letter.post," +
      "Music.listen,Song.compose,Song.play,Song.listen," +
      "Sign.read,Sign.follow," +
      "Reader,Writer,Author,Composer,Listener,Reviewer,Reviewer2," +
      "Sender,AllRead,AllBook,AllRoles,AllResources,AllAccess"
    );
    done();
  });

  it ('Updates after wildcards should update affected access definitions', function(done) {
    access.define(extra);
    verifyAccess(access.AllRead,
      "AllRead,Book.read,Letter.read,Sign.read,Music.listen,Mind.read"
    );
    verifyAccess(access.AllBook,
      "AllBook,Book.read,Book.write,Book.browse,Book.edit,Book.scan"
    );
    verifyAccess(access.AllRoles,
      "Book.read,Book.write,Book.browse,Book.edit," +
      "Letter.read,Letter.write,Letter.send,Letter.post," +
      "Music.listen,Song.compose,Song.play,Song.listen," +
      "Sign.read,Sign.follow," +
      "Reader,Writer,Author,Composer,Listener,Reviewer,Reviewer2," +
      "Sender,AllRead,AllBook,AllRoles,AllResources,AllAccess," +
      "Extra,Mind.read,Book.scan"
    );
    verifyAccess(access.AllAccess,
      "Book.read,Book.write,Book.browse,Book.edit," +
      "Letter.read,Letter.write,Letter.send,Letter.post," +
      "Music.listen,Song.compose,Song.play,Song.listen," +
      "Sign.read,Sign.follow," +
      "Reader,Writer,Author,Composer,Listener,Reviewer,Reviewer2," +
      "Sender,AllRead,AllBook,AllRoles,AllResources,AllAccess," +
      "Extra,Mind.read,Book.scan"
    );
    done();
  });

  it ('should be able to lock access', function(done) {
    access.lock();
    (access.define === undefined).should.be.true;
    done();
  });

  it ('should not allow roles/resources/actions using reserved names', function(done) {
    var badNames = [
      { resource: 'and', action: 'action1,action2' },
      { resource: 'resource1,_resource2', action: 'action1,grantTo' },
      { role:  '_makeArray'},
      { role: 'role', access: { resource: '_getAcl', action: 'action1,action2' }},
      { role: 'role', access: { resource: 'resource1,resource2', action: 'and,or' }}
    ];
    badNames.forEach(function(badName) {
      (function() { access.define(badName)}).should.throw();
    });
    done();
  });

  it ('should not be able to mix up roles, resources and actions', function(done) {
    var usedNames= [
      { role: 'Song' },
      { role: 'read' },
      { resource: 'read' },
      { resource: 'Reader', action: 'read' }
    ];
    usedNames.forEach(function(usedName) {
      (function() { access.define(usedName)}).should.throw();
    });
    done();
  });

  it ('should be able to create simple acls', function(done) {
    verifyAccess(access.Book.Letter.read.write,
      "Book.read,Book.write,Letter.read,Letter.write"
    );
    verifyAccess(access.Reader,
      "Reader,Book.read,Book.browse,Letter.read"
    );
    verifyAccess(access.Reader.Composer.Sender,
      "Reader,Book.read,Book.browse,Letter.read,Composer,Song.compose,Sender,Letter.write,Letter.send,Letter.post"
    );
    done();
  });

  it ('should be able to create combined acls', function(done) {
    verifyAccess(access.Reader.Song.listen.or.Author.Song.compose, [
      "Reader,Book.read,Book.browse,Letter.read,Song.listen",
      "Author,Book.read,Book.write,Book.edit,Song.compose"
    ]);
    done();
  });

  it ('should be able to limit acls using except', function(done) {
    verifyAccess(access.Reader.or.Writer.except.Book.read, [
      "Reader,Book.read,Book.browse,Letter.read",
      "Writer,Author,Book.write,Book.edit,Composer,Song.compose,Letter.send"
    ]);
    done();
  });

  it ('should be able to create complex acls with combined roles', function(done) {
    verifyAccess(access.Reviewer.Letter.send, [
      "Reviewer,Reader,Book.read,Book.browse,Letter.read,Book.edit,Letter.send",
      "Reviewer,Listener,Music.listen,Letter.send",
      "Reviewer,Author,Book.read,Book.write,Book.edit,Letter.send"
    ]);
    done();
  });

  it ('should be able to create complex acls with exception clause', function(done) {
    verifyAccess(access.Reviewer.except.Book.read, [
      "Reviewer,Reader,Book.browse,Letter.read,Book.edit",
      "Reviewer,Listener,Music.listen",
      "Reviewer,Author,Book.write,Book.edit"
    ]);
    verifyAccess(access.Letter.send.Reviewer2.except.Book.read, [
      "Letter.send,Reviewer2,Reader,Book.browse,Letter.read,Book.edit",
      "Letter.send,Reviewer2,Listener,Music.listen",
      "Letter.send,Reviewer2,Author,Book.write,Book.edit"
    ]);
    done();
  });

  it ('should be able to create acls using eval', function(done) {
    var result = [
      "Reader,Book.read,Book.browse,Letter.read,Song.listen",
      "Author,Book.read,Book.write,Book.edit,Song.compose"
    ];
    verifyAccess(access.eval('Reader.Song.listen.or.Author.Song.compose'), result);
    verifyAccess(access.eval('Reader').Song.listen.or.Author.Song.compose, result);
    verifyAccess(access.Reader.eval('Song.listen').or.Author.Song.compose, result);
    verifyAccess(access.eval('Reader.Song.listen').or.eval('Author.Song.compose'), result);
    verifyAccess(access['Reader'].Song.listen.or.Author.Song.compose, result);
    verifyAccess(access['Reader']['Song'].listen.or.Author.Song.compose, result);
    done();
  });

  it ('should be able to optimize required acls', function(done) {
    var acl = access.Writer.or.Author.getAcl();
    verifyAccess(acl, [
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send',
      'Author,Book.read,Book.write,Book.edit'
    ]);
    acl.requiredFor(function(){});
    verifyAccess(acl, [
      'Author,Book.read,Book.write,Book.edit'
    ]);
    acl = access.Book.write.Song.compose.or.Writer.getAcl();
    verifyAccess(acl, [
      'Book.write,Song.compose',
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send'
    ]);
    acl.requiredFor(function(){});
    verifyAccess(acl, [
      'Book.write,Song.compose'
    ]);
    acl = access.Reviewer2.or.Book.read.getAcl();
    verifyAccess(acl, [
      "Reviewer2,Reader,Book.read,Book.browse,Letter.read,Book.edit",
      "Reviewer2,Listener,Music.listen",
      "Reviewer2,Author,Book.read,Book.write,Book.edit",
      "Book.read"
    ]);
    acl.requiredFor(function(){});
    verifyAccess(acl, [
      "Reviewer2,Listener,Music.listen",
      "Book.read"
    ]);
    done();
  });

  it ('should be able to optimize granted acls', function(done) {
    var acl, req = {};
    acl = access.Writer.or.Author.getAcl();
    verifyAccess(acl, [
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send',
      'Author,Book.read,Book.write,Book.edit'
    ]);
    acl.grantTo(req);
    verifyAccess(acl, [
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send'
    ]);
    acl = access.Book.write.Song.compose.or.Writer.getAcl();
    verifyAccess(acl, [
      'Book.write,Song.compose',
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send'
    ]);
    acl.grantTo(req);
    verifyAccess(acl, [
      'Writer,Author,Book.read,Book.write,Book.edit,Composer,Song.compose,Letter.send'
    ]);
    acl = access.Reviewer2.or.Book.read.getAcl();
    verifyAccess(acl, [
      "Reviewer2,Reader,Book.read,Book.browse,Letter.read,Book.edit",
      "Reviewer2,Listener,Music.listen",
      "Reviewer2,Author,Book.read,Book.write,Book.edit",
      "Book.read"
    ]);
    acl.grantTo(req);
    verifyAccess(acl, [
      "Reviewer2,Reader,Book.read,Book.browse,Letter.read,Book.edit",
      "Reviewer2,Listener,Music.listen",
      "Reviewer2,Author,Book.read,Book.write,Book.edit"
    ]);
    done();
  });

  it ('should be able to verify granted acl with required acls', function(done) {
    var requiredAcl = access.Reviewer2.or.Book.read.getAcl();
    requiredAcl.isGrantedTo(access.Reviewer2.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Reader.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Listener.getAcl()).should.be.false;
    requiredAcl.isGrantedTo(access.Reviewer2.Listener.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Author.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Book.read.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Book.read.Book.write.getAcl()).should.be.true;
    requiredAcl.isGrantedTo(access.Book.write.Book.browse.getAcl()).should.be.false;
    done();
  });

  it ('should be able to filter acls', function(done) {
    var allowedAcl,requestedAcl;
    allowedAcl = access.Reviewer2.or.Book.read.getAcl();

    requestedAcl = access.Book.read.filter(allowedAcl);
    verifyAccess(requestedAcl, 'Book.read');

    requestedAcl = access.Listener.filter(allowedAcl);
    verifyAccess(requestedAcl, 'Listener,Music.listen');

    requestedAcl = access.Reviewer2.or.Book.read.filter(allowedAcl);
    verifyAccess(requestedAcl, [
      "Reviewer2,Reader,Book.read,Book.browse,Letter.read,Book.edit",
      "Reviewer2,Listener,Music.listen",
      "Reviewer2,Author,Book.read,Book.write,Book.edit"
    ]);
    done();
  });

  it ('should be able to select roles only in filtered acls', function(done) {
    var allowedAcl,requestedAcl;
    allowedAcl = access.Reviewer2.or.Book.read.getAcl();

    requestedAcl = access.Book.read.getAcl();
    requestedAcl.filter(allowedAcl, { rolesOnly: true });
    verifyAccess(requestedAcl, '');

    requestedAcl = access.Listener.getAcl();
    requestedAcl.filter(allowedAcl, { rolesOnly: true });
    verifyAccess(requestedAcl, 'Listener');

    requestedAcl = access.Reviewer2.or.Book.read.getAcl();
    requestedAcl.filter(allowedAcl, { rolesOnly: true });
    verifyAccess(requestedAcl, [
      "Reviewer2,Reader",
      "Reviewer2,Listener",
      "Reviewer2,Author"
    ]);
    done();
  });

  it ('should be able to select options in Acl.toString', function(done) {
    var acl = access.Writer.getAcl();
    verifyAccess(access.Writer.toString(), "Writer,Author,Composer,Book.read,Book.write,Book.edit,Song.compose,Letter.send");
    verifyAccess(acl.toString(), "Writer,Author,Composer,Book.read,Book.write,Book.edit,Song.compose,Letter.send");
    verifyAccess(acl.toString({ roles: true, permissions: false, brackets: true }), "Writer,Author,Composer", "Book.read,Book.write,Book.edit,Song.compose,Letter.send" );
    verifyAccess(acl.toString({ roles: false, permissions: true, brackets: false }), "Book.read,Book.write,Book.edit,Song.compose,Letter.send", "Writer,Author,Composer");
    acl.toString().should.equal('[' + acl.toString({ brackets: false }) + ']');
    done();
  });

  it ('should be able to export/import Acl to/from string', function(done) {
    var acl1,acl2;
    acl1 = access.Reader.Song.listen.or.Author.Song.compose.getAcl();
    acl2 = access.eval(acl1.toString({export: true})).getAcl();
    acl2.equals(acl1).should.be.true;
    acl2 = access.eval(acl1.toString({permissions: false, export: true})).getAcl();
    acl2.equals(acl1).should.be.false;
    acl2.equals(access.Reader.or.Author.getAcl()).should.be.true;
    acl2 = access.eval(acl1.toString({roles: false, export: true})).getAcl();
    acl2.equals(acl1).should.be.false;
    acl2.equals(access.
      Book.Letter.read.Book.browse.Song.listen
      .or.
      Book.read.write.edit.Song.compose.getAcl()
    ).should.be.true;
    done();
  });

});

describe("Access-object", function() {

  var specs,testBook;

  beforeEach(function() {
    testBook = {
      title: 'testBook',
      content: 'many pages',
      bookmarks: 'my bookmarks',
      notes: 'my notes',
      sold: 100
    };
    var bookRead = access.Book.read.getAcl();
    var bookWrite = access.Book.write.getAcl();
    specs = {
      title: { read: 'Book.read', write: 'Author' },
      content: { read: bookRead, write: bookWrite },
      bookMarks: { rdwr: 'Reader' },
      sold: { rdwr: 'Writer' }
    };
  });

  it ('should be able to provide read protection for external objects', function(done) {
    var protect = access.protect(specs);
    var result = protect.$extractFor(access.Reader.getAcl(), testBook);
    result.should.match({
      title: 'testBook',
      content: 'many pages',
      bookmarks: 'my bookmarks',
      notes: 'my notes'
    });
    result = protect.$extractFor(access.Writer.getAcl(), testBook);
    result.should.match(testBook);
    done();
  });

  it ('should be able to provide write protection for external objects', function(done) {
    var protect = access.protect(specs);
    var result = protect.$updateBy(
      access.Reader.getAcl(),
      {
        title: 'otherBook',
        content: 'new pages',
        bookmarks: 'new bookmarks',
        notes: 'new notes',
        sold: 101
      },
      testBook
    );
    result.should.match({
      title: 'testBook',
      content: 'many pages',
      bookmarks: 'new bookmarks',
      notes: 'new notes',
      sold: 100
    });
    result = protect.$updateBy(
      access.Author.getAcl(),
      {
        title: 'otherBook',
        content: 'more pages',
        bookmarks: 'more bookmarks',
        notes: 'more notes',
        sold: 101
      },
      testBook
    );
    result.should.match({
      title: 'otherBook',
      content: 'more pages',
      bookmarks: 'more bookmarks',
      notes: 'more notes',
      sold: 100
    });
    result = protect.$updateBy(
      access.Writer.getAcl(),
      {
        title: 'yet anotherBook',
        content: 'even more pages',
        bookmarks: 'even more bookmarks',
        notes: 'even more notes',
        sold: 101
      },
      testBook
    );
    result.should.match({
      title: 'yet anotherBook',
      content: 'even more pages',
      bookmarks: 'even more bookmarks',
      notes: 'even more notes',
      sold: 101
    });
    result.should.match(testBook);
    done();
  });

  it ('should be able to add read protection to existing objects', function(done) {
    access.protect(specs, testBook);
    var result = testBook.$extractFor(access.Reader.getAcl());
    result.should.match({
      title: 'testBook',
      content: 'many pages',
      bookmarks: 'my bookmarks',
      notes: 'my notes'
    });
    result = testBook.$extractFor(access.Writer.getAcl());
    result.should.match(testBook);
    done();
  });

  it ('should be able to add write protection to existing objects', function(done) {
    access.protect(specs, testBook);
    testBook.$updateBy(
      access.Reader.getAcl(),
      {
        title: 'otherBook',
        content: 'new pages',
        bookmarks: 'new bookmarks',
        notes: 'new notes',
        sold: 101
      }
    );
    testBook.should.match({
      title: 'testBook',
      content: 'many pages',
      bookmarks: 'new bookmarks',
      notes: 'new notes',
      sold: 100
    });
    testBook.$updateBy(
      access.Author.getAcl(),
      {
        title: 'otherBook',
        content: 'more pages',
        bookmarks: 'more bookmarks',
        notes: 'more notes',
        sold: 101
      }
    );
    testBook.should.match({
      title: 'otherBook',
      content: 'more pages',
      bookmarks: 'more bookmarks',
      notes: 'more notes',
      sold: 100
    });
    testBook.$updateBy(
      access.Writer.getAcl(),
      {
        title: 'yet anotherBook',
        content: 'even more pages',
        bookmarks: 'even more bookmarks',
        notes: 'even more notes',
        sold: 101
      }
    );
    testBook.should.match({
      title: 'yet anotherBook',
      content: 'even more pages',
      bookmarks: 'even more bookmarks',
      notes: 'even more notes',
      sold: 101
    });
    done();
  });

});

var express = require('express');
var http = require('./utils/http');

describe("Access-express", function() {

  var app,grantedAcl,optCount,handler;

  function sendOk(req,res) {
    res.status(200).send();
  }

  before(function(done) {
    app = express();
    http.createServer(app, function() {
      app.use(function (req, res, next) {
        grantedAcl.grantTo(req);
        if (handler)
          handler(req,res,next);
        else
          next();
      });
      done();
    });
    optCount = {};
  });

  beforeEach(function() {
    handler = null;
  });

  it ('should control access to express routers through method overloading', function(done) {
    grantedAcl = access.Writer.getAcl();
    app.use('/Book/read', access.Book.read.requiredFor(sendOk));
    app.use('/Book/write', access.Book.write.requiredFor(sendOk));
    async.waterfall([
      function(next) {
        http.request()
          .get('/Book/read')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Book/write')
          .expect(200, null, next);
      },
      function(next) {
        grantedAcl = access.Reader.getAcl();
        http.request()
          .get('/Book/read')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Book/write')
          .expect(403, null, next);
      },
      function(next) {
        handler = function(req,res,next) {
          access.Book.write.extendTo(req);
          next();
        };
        http.request()
          .get('/Book/read')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Book/write')
          .expect(200, null, next);
      }
    ], done);
  });

  it ('should control access to routers through express middleware', function(done) {
    app.use('/Music', access.Listener.or.Composer.required);
    app.use('/Music/listen', sendOk);
    app.use('/Music/compose', access.Composer.required, sendOk);
    async.waterfall([
      function(next) {
        grantedAcl = access.Reader.getAcl();
        http.request()
          .get('/Music/listen')
          .expect(403, null, next);
      },
      function(next) {
        grantedAcl = access.Listener.getAcl();
        http.request()
          .get('/Music/listen')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Music/compose')
          .expect(403, null, next);
      },
      function(next) {
        grantedAcl = access.Composer.getAcl();
        http.request()
          .get('/Music/compose')
          .expect(200, null, next);
      }
    ], done);
  });

  it ('should be able to overload all options methods', function(done) {

    var newOptions = {};
    var orgOptions = access.options;
    for (var option in orgOptions) {
      optCount[option] = 0;
      if (typeof option === "function") {
        newOptions[option] = (function() {
          var __option = option;
          var __orgMethod = orgOptions[option];
          return function() {
            optCount[__option]++;
            return __orgMethod.apply(this, arguments);
          }
        })();
      }
    }
    access.options = newOptions;

    async.waterfall([
      function(next) {
        grantedAcl = access.Reader.getAcl();
        http.request()
          .get('/Book/read')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Book/write')
          .expect(403, null, next);
      },
      function(next) {
        grantedAcl = access.Listener.getAcl();
        http.request()
          .get('/Music/listen')
          .expect(200, null, next);
      },
      function(next) {
        http.request()
          .get('/Music/compose')
          .expect(403, null, next);
      }
    ], function() {
      for (var option in optCount) {
        if (typeof option === "function")
          optCount[option].should.be.above(0);
      }
      done();
    });

  });

  after(function(done) {
    // Allow time to flush console output before exit
    setTimeout(done, 200);
  });

});
