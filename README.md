# griffin #

Provides comprehensive access control through a simple but powerful dot notation syntax

## Installation ##

```
$ npm install griffin
```

## Introduction ##
Griffin is a comprehensive access control list (ACL) framework for NodeJS server applications. It manages access to incoming requests and controls which properties of an object can be changed or retrieved by clients based on custom access rules which are specified through a simple but powerful dot notation syntax. All roles and permissions are defined globally in a single module:
```javascript
/* access.js */
var access = require('griffin');
access.define([
  { role: 'Reader', access: [
    { resource: 'Book', action: 'read,browse' },
    { resource: 'Letter', action: 'read' }
  ]},
  { role: 'Author', access: [
    { resource: 'Book', action: 'read,write,edit' },
    { resource: 'Letter', action: 'read,write,send' }
  ]}
]);
module.exports = access;
```
Using the defined permissions and roles, access is granted to incoming requests based on your local business rules.
```javascript
/* router.js */
var express = require('express');
var access = require('./access');
var router = express.Router();
router.use(function(req,res) {
  var user = /* your code here */
  switch(user) {
    case 'someReader':
      // Grant access using roles ...
      access.Reader.grantTo(req);
      break;
    case 'anotherReader':
      // or using permisssions ...
      access.Book.read.browse.Letter.read.grantTo(req);
      break;
    case 'someWriter':
      // or any combination
      access.Reader.and.Book.write.grantTo(req);
      break;
  }
});
...
```
Access to routes can then be controlled through routing with middleware
```javascript
/* router.js (cont'd) */
var book = require('./book');
router.get('/book/:book', access.Book.read.required, book.read);
...
```
```javascript
/* book.js */
exports.read = function(req,res) {
  // Not invoked unless Book.read permission granted to request
}
...
```
or through modified controller methods
```javascript
/* router.js (cont'd) */
router.put('/book/:book', book.write);
```
```javascript
/* book.js (cont'd) */
var access = require('./access');
exports.write = access.Author.requiredFor(function(req,res) {
  // Not invoked unless Author role assigned to request
});
```
Access verification and control can also be performed within the function body:
```javascript
exports.bookEdit = function (req,res) {
	// Verify read access
	if (access.Book.read.isGrantedTo(req)) {
		// Allow read access
	} else {
		// Deny read access
	}
}
```
Griffin can also add access control capabilities to generic objects
```javascript
// Some generic book object
var someBook = {
  content: 'some content',
  sold: 100,
  reviews: 'some reviews'
};
// Access control specs for books
var bookSpecs = {
  // Book.read permission required to read content
  // while only Author can write
  content: { read: 'Book.read', write: 'Author' },
  // Only Author can read and write number of books sold
  sold: { rdwr: 'Author' }
  // Anyone with Book.read permission can read reviews
  // but only Readers can write or update a review
  reviews: { read: 'Book.read', write: 'Reader' }
};
// Add access control methods $extract, $update and $filter to 
// someBook object to restrict access to its properties 
access.protect(bookSpecs, someBook);
```
Now the $extact method is available to retrieve property values based on granted access.
```javascript
// Authors will receive entire someBook object in response
access.Writer.grantTo(req);
var authorData = someBook.$extract(req);
res.send(authorData);
// sends { content: 'some content', reviews: 'some reviews', sold: 100 }
```
```javascript
// Readers will not receive the sold property
var readerData - someBook.$extract(access.Reader.getAcl());
res.send(readerData);
// sends { content: 'some content', reviews: 'some reviews' }
```
Use the $update method to allow object changes based on granted access
```javascript
// Authors can update the sold property, but not reviews
access.Writer.grantTo(req);
someBook.$update(req, { sold: 123, reviews: 'best book ever' });
// someBook = { content: 'some content', sold: 123, reviews: 'some reviews' }
```
```javascript
// Authors can update reviews but not number of books sold
access.Reader.grantTo(req);
someBook.$update(req, { sold: 200, reviews: 'book is ok' });
// someBook = { content: 'some content', sold: 123, reviews: 'book is ok' }
```
Access notation can be simple as shown in the examples above but can also contain a complex combination of roles and permissions. The following example will allow access to the page writing function if the incoming request is granted *Book read+write+browse* permissions and *Letter read+write* permissions (all listed permissions are required). Alternatively, access is also allowed if the request is granted both the *Reader* and *Writer* roles.
```javascript
exports.writePage = access
	.Book.Letter.read.write.and.Book.browse
	.or
	.Reader.Writer
	.requiredFor(function (req,res) {
		// Implement page writing here ...
});
```
Dynamic access notation using strings is supported as follows:
```javascript
var bookWrite='Reader.Book.write', role='Reader', resource='Book', action='edit';
// The following acccess notations are all equivalent
access.Reader.Book.write.requiredFor(...)
access.eval(bookWrite).requiredFor(...)
access.Reader[resource]['write'].requiredFor(...)
access[role][resource][action].requiredFor(...)
access.Reader.eval('Book.write').requiredFor(...)
```
By default, Griffin returns HTTP status 403 "Forbidden" with message "Access denied" when access is not permitted but the response behavior is configurable. See Griffin Customization below for more details about configurable options:
```javascript
var access = require('griffin');
// It is recommended to return HTTP 404 "Not Found" without failure message if server does
// not wish to reveal exactly why the request has been refused  
access.options.errorStatus = 404;
access.options.errorMessage = null;
```
## Access Definition ##
Griffin defines access control through the notion of permissions, resources, actions and roles. A resource identifies an application specific data set that requires protection from unauthorized access like user info or blog contents. Actions define what operations can be performed on that resource and depend on the nature of the data involved. A particular action associated with a specific resource is known as a permission. Permissions can be grouped into roles to form a  logical set of access rules, but roles can also be defined without permissions to simply identify generic access classes. A role can also include other smaller roles.     

### Permissions ###
Permissions are defined using the following structure:

```javascript
access.define([
	{ resource: 'Book', action: 'read' },
	{ resource: 'Book', action: 'write' }
]);
access.define({ resource: 'Book', action: 'browse' });
```
Note that access definitions may be extended by calling *access.define()* more than once. The example above defines permissions *Book.read*, *Book.write* and *Book.browse*, but can be written more efficiently by listing all actions together as follows:
```javascript
access.define({ resource: 'Book', action: 'read,write,browse' });
```
The same shorthand notation can also be used for resources. The following will define permissions *Book.read*, *Book.write*, *Letter.read* and *Letter.write*. 
```javascript
access.define({ resource: 'Book,Letter', action: 'read,write' });
```
### Roles ###
As noted above, roles may group multiple permissions together and may also include other roles:
```javascript
access.define([
	{ resource: 'Book', action: 'read,edit,browse' },
    { role: 'Reader', access: [
        { resource: 'Book', action: 'read,browse' },
        { resource: 'Letter', action: 'read' }
    ]},
    { role: 'Writer', access: [
		{ role: 'Reader' },
        { resource: 'Book', action: 'write,edit' },
        { resource: 'Letter', action: 'write,send' }
    ]},
	{ role: 'User' }
]};
```
Note that permissions may be defined first or included on the fly during role definitions. Griffin will register any role or permission the first time it is encountered in the access structure. Also note that roles may include other roles or may not define access permissions at all.

### Wildcards ###
Wildcards may be used to assign all applicable actions or resources to a particular role:
```javascript
access.define([
	{ resource: 'Book', action: 'read,edit,browse' },
	{ resource: 'Letter', action: 'read' },
	{ resource: 'Mail', action: 'send,receive' },
	{ role: 'Author', access: { resource: 'Book', action: '*' }},
	{ role: 'Reader', access: [ resource: '*', action: 'read' }},
	{ role: 'Admin', access: '*' }
]};
```
In the example above, *Author* is assigned permissions *Book.read*, *Book.edit* and *Book.browse* while *Reader* is assigned *Book.read* and *Letter.read*. Also note how the wildcard is used to assign all available permissions to *Admin*.
### Locking Access Definitions ###
Once all access has been defined, further modifications can be prohibited by calling *access.lock()*. Once *lock()* has been called, all relevant access related objects will be frozen and *access.define()* will no longer be available. It is not possible to unlock access once it has been locked. This can help enhance security by making it harder to compromise resources due to accidental (or deliberate) access modifications once the application is up and running.
## Access Control List ##
Access control is specified through the use of a simple but powerful dot notation syntax. In its basic form, an access control list (**ACL**) consists of any combination of roles and permissions, with permissions consisting of resource(s) paired with action(s). The resulting ACL contains all the listed roles and permissions including all permissions grouped within the roles. 
```javascript
var access = require('griffin');
access.Author.Reader.Book.Letter.read.write.Book.browse.requiredFor(..)
```
Assuming all elements have been properly defined through *access.define()*, this example produces an ACL that includes roles *Author* and *Reader* and permissions *Book.read*, *Book.write*, *Letter.read*, *Letter.write* and *Book.browse*. As shown above, all actions are associated with all resources directly preceding it which allows the notation to be more concise. Also note how resources and roles are capitalized while actions are all lowercase. This is not required of course but highly recommended to enhance readability. Adding a *role* postfix like *readerRole* or *adminRole* or *data* postfix for resources like *userData* may be helpful as well. 
### .and ###
To enhance readability, the *and* keyword may be used anywhere without altering the ACL in any way.
```javascript
access.Author.and.Reader.and.Letter.read.write.and.Book.read.write.browse.grantTo(..)
```
### .except ###
If a role includes more permissions than desired, access can be limited by using the *except* keyword followed by the set of permissions that should be excluded:  
```javascript
access.Admin.except.Mail.send.receive.grantTo(..)
```
### .or ###
The *or* keyword can be used to extend an ACL to include more than one list of roles and permissions. During access verification, each list will be evaluated and access will be granted if at least one of them meets the access requirements.
```javascript
exports.Review = access
    .Book.read.write
    .or
    .Letter.read.write
    .requiredFor(function(req,res) {
        // Implement reviewing code here 
});
```
### Dynamic Notation ###
The *eval* method can be used anywhere in the dot notation to add dynamic components to the access control list. It accepts a string representation of the required roles and/or permissions and is otherwise identical to the hard-coded dot notation. The following lines all produce the exact same ACL:
```javascript
access.Reader.Book.write.getAcl()
access.eval('Reader.Book.write').getAcl()
access.Reader.eval('Book.write').getAcl()
```
Passing strings with an invalid notation syntax or with undefined roles or permissions to the *eval* method will throw an exception. Method *isValid* can be used to validate a string before attempting to create an ACL dynamically.  
```javascript
if (access.isValid(someAclString)) {
	acl = access.eval(someAclString).getAcl();
} else {
	console.log('Invalid ACL string');
}
```
Use methods *isRole* and *isResource* to determine if a component used in dynamic notation represents either a role or a resource:
```javascript
if (access.isRole('Reader'))
	console.log('Reader is a role');
if (access.isResource('Book'))
	console.log('Book is a resource');
```
Although more limited than the *eval*() method, dynamic content is also available through standard JavaScript of course.  The following examples produce the same ACL as above: 
```javascript
var role='Reader', resource='Book', action='edit';
access.Reader[resource]['write'].getAcl()
access[role][resource][action].getAcl()
```
## Access Verification ##
Defining access requirements would not by very useful without means to enforce them of course. Griffin provides several methods to integrate access verification depending on your implementation needs. All methods are designed to make verification as simple and non-obtrusive as reasonably possible.

### .grantTo() ###
Verification involves comparing access rights that have been granted with rights that are actually required to perform a particular function. With Express, the main execution flow is handled through the incoming *request* and outgoing *response* objects. Use the *grantTo* method to assign the appropriate rights to an incoming request based on your local requirements, like in the following (highly simplified) example:  
```javascript
exports.authenticate = function(req, res) {
	if (req.user === "teacher")
		access.Reader.Writer.except.Letter.send.grantTo(req);
	else if (req.user === "student") 
		access.Book.read.grantTo(req);
}
```
Use the *getAcl* method to retrieve the ACL that has been granted to the incoming request:
```javascript
access.Book.read.grantTo(req);
...
var acl = access.getAcl(req);
```
### .requiredFor() ###
Once access has been granted to an incoming request, the *requiredFor* method makes it very simple to add access verification to a conventional controller method:
```javascript
exports.readPage = access.Reader.requiredFor(function (req,res) {
	// Implement page reading here ...
});
```
The *requiredFor* method returns a modified version of the specified controller method by checking the rights granted to the request with the specified access requirements before invoking the original method. When a violation is detected, the original method is not invoked and an error status response is returned instead. The *requiredFor* method will not alter the arguments to and return values from the original controller method in any way. 
### .required ###
The *required* property returns a middleware function that can be used directly by routers to perform authorization:
```javascript
var app = express();
app.use('/Book/read', access.Book.read.or.Book.browse.required);
app.use('/Book/edit', access.Writer.required, editBook);
```
### .getAcl() ###
Instead of performing authorization directly on the ACL produced through the dot notation, Griffin also provides the *getAcl* method to retrieve the ACL and assign it to a variable for later use. This is most useful when the same access control list is required in multiple locations throughout your code. The returned ACL can be used in exactly the same way as the dot notation:
```javascript
var readAccess = access.Book.read.or.Book.browse.required.getAcl();
exports.readCover = readAccess.requiredFor(function (req,res) {
	// Implement cover reading here
});
exports.readPage = readAccess.requiredFor(function (req,res) {
	// Implement page reading here
});  
exports.readIndex = readAccess.requiredFor(function (req,res) {
	// Implement index reading here
});
```
### .isGrantedTo() ###
Use the *isGrantedTo* method to perform verification within the code body and control program flow accordingly:
```javascript
exports.bookEdit = function (req,res) {
	// Verify read access
	if (access.Book.read.isGrantedTo(req)) {
		// Allow read access
	} else {
		// Deny read access
	}
}
```
### .filter() ###
The *filter* method updates the ACL by filtering out any roles and permissions not present in the ACL passed in as argument, basically ANDing the ACL with another ACL:
```javascript
access.define([
  { role: 'Reader', access: { resource: 'Book', action: 'read,browse' } },
  { role: 'Writer', access: [{ role: 'Reader' }, { resource: 'Book', action: 'write,edit' }] }
]);
var allowedAcl = access.Book.read.write;

console.log('Result: ' + access.Reader.filter(allowedAcl));
// => Result: [Book.read]

console.log('Result: ' + access.Writer.filter(allowedAcl));
// => Result: [Book.read,Book.write]
```
### .toString() ###
The *toString* method converts an ACL to a string. By default, the method will produce a comma delimited list of all roles and permissions included in the ACL and enclosed in brackets as follows:
```javascript
access.define([
  { role: 'Reader', access: { resource: 'Book', action: 'read,browse' } },
  { role: 'Writer', access: [{ role: 'Reader' }, { resource: 'Book', action: 'write,edit' }] }
]);
console.log(access.Reader.or.Writer.toString());
// => "[Book.read,Book.browse,Reader] || [Book.read,Book.browse,Book.write,Book.edit,Reader,Writer]"
```
Options can be passed to the *toString* method to control the conversion process through the following properties:
```javascript
var options = {
	roles: boolean,			// Include roles in string (default: true)
	permissions: boolean,	// Include permissions in string (default: true)
	brackets: boolean		// Enclose each ACL list in brackets (default: true)
};
```
Some examples using the *toString* method with options: 

```javascript
access.Writer.toString({ roles: true, permissions: false, brackets: false });
// => "Reader,Writer"

access.Reader.or.Writer.toString({ roles: false, permissions: true });
// => "[Book.read,Book.browse] || [Book.read,Book.browse,Book.write,Book.edit]"
```
## Griffin Customization ##
The default Griffin implementation is designed for integration with Express and to return HTTP status 403 "Forbidden" with message "Access denied" when access is not permitted. However, Griffin provides options to change the error response behavior and an adaption layer to simplify integration with other frameworks. Options can be changed directly on the access object:
```javascript
var access = require('griffin');
// It is recommended to return HTTP 404 "Not Found" without failure message if server does
// not wish to reveal exactly why the request has been refused  
access.options.errorStatus = 404;
access.options.errorMessage = null;
```
Alternatively, option values can be modified by assigning a custom options object. Griffin will replace the  specified options while leaving all other options unchanged:
```javascript
var access = require('griffin');
// It is recommended to return HTTP 404 "Not Found" without failure message if server does
// not wish to reveal exactly why the request has been refused  
access.options = {
  errorStatus: 404,
  errorMessage: null 
};
```
Griffin implements an adaption layer through a set of functions defined as option properties. Whenever access processing requires framework specific implementations, Griffin will call these functions to abstract framework dependent functionality. The default integration for Express is implemented in module *acl-options* in the Griffin package. When adapting for other frameworks, it is recommended to use this module as a reference.

### Adapter layer functions ###

**setAcl**(*arguments*) - Assign granted ACL to incoming request using framework specific arguments

**getAcl**(*arguments*) - Extract granted ACL from request using framework specific arguments

**cont**(*arguments*) - Called with the *access.required* middleware function to continue processing by subsequent middleware since access has been granted

**halt**(*arguments*) - Called with the *access.required* middleware function to halt further processing since access has been denied

**accept**(*arguments*) - Called with *access.requiredFor* when access has been granted and the target function is about to be invoked.  

**reject**(*arguments*) - Called with *access.requiredFor* to perform framework specific processing when access to the target function has been denied.
 