# griffin #

Provides attribute-like access control through a simple but powerful dot notation syntax

## Installation ##

```
$ npm install griffin
```

## Introduction ##
Griffin is an NPM plug-in providing full access control through a simple but powerful dot notation syntax. Access is defined once at startup through permissions and roles. Permissions identify possible actions for a protected resource  while roles can group one or more permissions together.
```javascript
var access = require('griffin');
access.define([
    { role: 'Reader', access: [
        { resource: 'Book', action: 'read,browse' },
        { resource: 'Letter', action: 'read' }
    ]},
    { role: 'Writer', access: [
        { resource: 'Book', action: 'read,write,edit' },
        { resource: 'Letter', action: 'read,write,send' }
    ]},
	{ role: 'Author', access: { resource: 'Book', action: '*' }},
	{ role: 'Admin', access: '*' }
]);
```
NOTE: The examples in this document are based on the default integration with Express but be aware that Griffin provides an adaption layer to simplify integration with other frameworks.

Access is granted to incoming requests based on your local business rules. The following example grants access using roles...
```javascript
access.Reader.grantTo(req);
```
or using permissions ...
```javascript
access.Book.read.browse.Letter.read.grantTo(req);
```
or any combination
```javascript
access.Reader.and.Book.write.grantTo(req);
```
Assuming permissions and roles are properly defined and granted to incoming requests, access to controller methods can be specified by simply using the same dot notation. The following example will return a controller method that prevents access to the specified function unless the *Reader* role has been granted to the incoming request:
```javascript
exports.readPage = access.Reader.requiredFor(function (req,res) {
	// Implement page reading here ...
});
```
Access notation can be as simple as shown above or a complex combination of roles and permissions. The following example will allow access to the page writing function if the incoming request is granted Book read+write+browse permissions and Letter read+write permissions (all listed permissions are required). Alternatively, access is also allowed if the request is granted both the Reader and Writer roles.
```javascript
exports.writePage = access
	.Book.Letter.read.write.and.Book.browse
	.or
	.Reader.Writer
	.requiredFor(function (req,res) {
		// Implement page writing here ...
});
```
Griffin provides several means to control access directly through the router:
```javascript
var app = express();
app.use('/Book/read', access.Book.read.or.Book.browse.required);
app.use('/Book/edit', access.Writer.required, editBook);
app.use('/Letter/send', access.Letter.send.requiredFor(mailController.send));
app.use(access.error); // Catch access violations
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
	// Require write access. Throw exception otherwise
	access.Book.write.requiredFor(req);
	// Won't get here unless Book.write access was granted
}
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
A custom exception is thrown whenever granted access is in violation with required access. By adding the following line to the end of the Express router, Griffin will convert this exception into a standard HTTP 403 status code response. The adaption layer will allow customization of this behavior to meet your needs or adapt to frameworks other than Express.
```javascript
app.use(access.error);
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
Note that access definitions may be extended by calling `access.define()` more than once. The example above defines permissions *Book.read*, *Book.write* and *Book.browse*, but can be written more efficiently by listing all actions together as follows:
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
Wildcards may be used to assign all applicable actions or resources to a particular role. In the following example, *Author* is assigned permissions *Book.read*, *Book.edit* and *Book.browse* while *Reader* is assigned *Book.read *and *Letter.read*. Also note how the wildcard is used to assign all available permissions to *Admin*.
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
### Locking Access Definitions ###
Once all access has been defined, further modifications can be prohibited by calling `access.lock()`. Once lock() has been called, all relevant access related objects will be frozen and `access.define()` will no longer be available. It is not possible to unlock access once it has been locked. This can help enhance security by making it harder to compromise resources due to accidental (or deliberate) access modifications once the application is up and running.
## Access Control List ##
Access control is specified through the use of a simple but powerful dot notation syntax. In its basic form, an access control list (**ACL**) consists of any combination of roles and permissions, with permissions consisting of resource(s) paired with action(s). The resulting ACL contains all the listed roles and permissions including all permissions grouped within the roles. 
```javascript
var access = require('griffin');
access.Author.Reader.Book.Letter.read.write.Book.browse.requiredFor(..)
```
Assuming all elements have been properly defined through `access.define()`, this example produces an ACL that includes roles *Author* and *Reader* and permissions *Book.read*, *Book.write*, *Letter.read*, *Letter.write* and *Book.browse*. As shown above, all actions are associated with all resources directly preceding it which allows the notation to be more concise. Also note how resources and roles are capitalized while actions are all lowercase. This is not required of course but highly recommended to enhance readability. Adding a *role* postfix like *readerRole* or *adminRole* may be helpful as well. 
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
The eval() method can be used anywhere in the dot notation to add dynamic components to the access control list. It accepts a string representation of the required roles and/or permissions and is otherwise identical to the hard-coded dot notation. The following lines all produce the exact same ACL:
```javascript
access.Reader.Book.write.getAcl()
access.eval('Reader.Book.write').getAcl()
access.Reader.eval('Book.write').getAcl()
```
Although more limited than the eval() function, dynamic content is also available through standard JavaScript of course.  The following examples produce the same ACL as above: 
```javascript
var role='Reader', resource='Book', action='edit';
access.Reader[resource]['write'].getAcl()
access[role][resource][action].getAcl()
```
## Access Verification ##
Defining access requirements would not by very useful without means to enforce them of course. Griffin provides several methods to integrate access verification depending on your implementation needs. All methods are designed to make verification as simple and non-obtrusive as reasonably possible.

### .grantTo() ###
Verification involves comparing access rights that have been granted with rights that are actually required to perform a particular function. With Express, the main execution flow is handled through the incoming *request* and outgoing *response* objects. Use the *grantTo* function to assign the appropriate rights to an incoming request based on your local requirements, like in the following (highly simplified) example:  
```javascript
exports.authenticate = function(req, res) {
	if (req.user === "teacher")
		access.Reader.Writer.except.Letter.send.grantTo(req);
	else if (req.user === "student") 
		access.Book.read.grantTo(req);
}
```
### .requiredFor() ###
Once access has been granted to an incoming request, the *requiredFor* function makes it very simple to add access verification to a conventional controller method:
```javascript
exports.readPage = access.Reader.requiredFor(function (req,res) {
	// Implement page reading here ...
});
```
The *requiredFor* function returns a modified version of the specified controller method by checking the rights granted to the request with the specified access requirements before invoking the original method. When a violation is detected, the original method is not invoked and an exception is thrown instead. The *requiredFor* function will not alter the arguments to and return values from the original controller method in any way. 

*requiredFor* can also be used within a function body to guard access to certain code sections by specifying the incoming request directly instead of through the controller method as shown in the followin example.
```javascript
exports.bookEdit = function (req,res) {
	var book = sampleBook.open();
	// Allow public read access 
	book.read()
	if (book.outOfDate()) {
		// Require write access. Throw exception otherwise
		access.Book.write.requiredFor(req);
		// Won't get here unless Book.write access was granted
		book.write();
	}
	book.close();
}
```
### .required ###
The *required* property returns a middleware function that can be used directly by routers to perform authorization:
```javascript
var app = express();
app.use('/Book/read', access.Book.read.or.Book.browse.required);
app.use('/Book/edit', access.Writer.required, editBook);
app.use(access.error); // Catch access violations
```
### .getAcl() ###
Instead of performing authorization directly on the ACL produced through the dot notation, Griffin also provides the *getAcl* function to retrieve the ACL and assign it to a variable for later use. This is most useful when the same access control list is required in multiple locations throughout your code. The returned ACL can be used in exactly the same way as the dot notation:
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
Use the *isGrantedTo* function to perform verification within the code body and control program flow accordingly:
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
 