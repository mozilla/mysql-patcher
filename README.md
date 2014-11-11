# mysql-patcher #

A package/program to help patch MySql databases. [![Build Status](https://api.travis-ci.org/chilts/mysql-patcher.svg)](https://travis-ci.org/chilts/mysql-patcher)

## Synopsis ##

This is the simplest program that can work:

```
var path = require('path')

var mysql = require('mysql')
var patcher = require('mysql-patcher')

var options = {
  user       : 'user',
  database   : 'db',
  password   : 'password',
  dir        : path.join(__dirname, 'schema'),
  patchKey   : 'schema-patch-level',
  patchLevel : 4,
  metaTable  : 'dbMetadata',
  mysql      : mysql,
}

patcher.patch(options, function(err, res) {
  console.log('err:', err)
  console.log('res:', res)
})
```

Note: you should require mysql yourself and pass this to `.patch()` so that we're using the version you
want, instead of us depending on mysql ourselves.

## .patch(options) ##

The options are passed straight through to MySql, so you can provide any of the following:

* https://github.com/felixge/node-mysql#connection-options

Discussed below are some of more regular ones, but if not provided they will take the defaults specified
on the mysql page (above):

* user                : the user for the database (requires permission to create the database if needed)
* password            : the password for the database
* host                : the host for the database
* port                : the port for the database
* socketPath          : the socket (instead of host and port)
* database            : the database name

Specific options for `mysql-patcher`:

* dir                 : string - the directory where the patch files live
* patchLevel          : integer - the level to which the database should patched
* metaTable           : string - the metaTable name
* patchKey            : string - the name of the row in the metaTable which stores the current patch
* createDatabase      : true/false - tries to create the database if it doesn't exist (default: false)
* reversePatchAllowed : true/false - allow reverse patching to take place (default: false)

## Database Patch Files ##

All patch files should be named in the following format:

* `<name>-<from>-<to>.sql`
* e.g. patch-0001-0002.sql

This example is a patch file from level 1 to level 2.

Each database patch file should perform any queries they want first, then the last statement should
set your `patchKey` value (in the `metaTable`) to the patch specified

### Your Initial Patch ###

Your initial patch shouldn't do much except create the `metaTable` and set the `patchKey` row to be 1.

If you don't know what to do, copy and paste these two files for your initial forward and reverse patches:

e.g. Forward patch file : `patch-00-01.sql`

```
CREATE TABLE dbMetadata (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

INSERT INTO dbMetadata SET name = 'schema-patch-level', value = '1';
```

e.g. Reverse patch file : `patch-01-00.sql`

```
DROP TABLE dbMetadata;
```

### Patches 2 and above ###

Once your initial patch has worked, each subsequent patch (both forward and reverse) should not try to insert the
patch level, but instead update it:

e.g. Forward patch file : `patch-01-02.sql`

```
UPDATE dbMetadata SET value = '2' WHERE name = 'schema-patch-level';
```

e.g. Reverse patch file : `patch-02-01.sql`

```
UPDATE dbMetadata SET value = '1' WHERE name = 'schema-patch-level';
```

## License ##

[Mozilla Public License v2](https://www.mozilla.org/MPL/2.0/)

(Ends)
