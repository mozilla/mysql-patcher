/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// core
var fs = require('fs')
var path = require('path')

// npm
var async = require('async')
var clone = require('clone')

// globals for this package
var noop = Function.prototype // a No Op function

var ERR_NO_SUCH_TABLE = 1146


// A stateful Patcher class for interacting with the db.
// This is the main export form this module.

function Patcher(options) {
  this.options = clone(options)

  // check the required options
  if ( !this.options.dir ) {
    throw new Error("Option 'dir' is required")
  }

  if ( !('patchLevel' in this.options ) ) {
    throw new Error("Option 'patchLevel' is required")
  }

  if ( !this.options.mysql || !this.options.mysql.createConnection ) {
    throw new Error("Option 'mysql' must be a mysql module object")
  }

  // set some defaults
  this.options.metaTable = this.options.metaTable || 'metadata'
  this.options.reversePatchAllowed = this.options.reversePatchAllowed || false
  this.options.patchKey = this.options.patchKey || 'patch'
  this.options.createDatabase = this.options.createDatabase || false

  // set this on the connection since we can have multiple statements
  // in every patch
  this.options.multipleStatements = true

  // some stub properties, mostly for documentation purposes.
  this.connection = null
  this.metaTableExists = undefined
  this.currentPatchLevel = undefined
  this.patches = {}
  this.patchesToApply = []

}


// Public API methods to connect and disconnect from the database,
// and patch to the desired level.

Patcher.prototype.connect = function connect(callback) {
  async.series(
    [
      this.createConnection.bind(this),
      this.createDatabase.bind(this),
      this.changeUser.bind(this),
      this.checkDbMetadataExists.bind(this),
      this.readDbPatchLevel.bind(this),
    ],
    (function(err) {
      // Ensure we close the connection on error.
      if (err) {
        if (this.connection) {
          this.connection.end(noop)
          this.connection = null
        }
        return callback(err)
      }
      return callback()
    }).bind(this)
  )
}

Patcher.prototype.end = function end(callback) {
  // Allow calling end() even if connect() failed, so that it's
  // easier for folks to clean up after themselves.
  if (this.connection) {
    this.connection.end(callback)
    this.connection = null
  } else {
    process.nextTick(callback)
  }
}

Patcher.prototype.patch = function patch(callback) {
  if (!this.connection) {
    callback('must call connect() before calling patch()')
  }
  async.series(
    [
      this.readPatchFiles.bind(this),
      this.checkAllPatchesAvailable.bind(this),
      this.applyPatches.bind(this),
    ],
    callback
  )
}


// Lower-level utility methods.
// These are factored out to make for a nice clean async control flow
// but probably shouldn't be called by external code.

Patcher.prototype.createConnection = function createConnection(callback) {
  // when creating the database, we need to connect without a database name
  var opts = clone(this.options)
  delete opts.database

  this.connection = this.options.mysql.createConnection(opts)
  this.connection.connect(function(err) {
    if (err) {
      return callback(err)
    }
    callback()
  })
}

Patcher.prototype.createDatabase = function createDatabase(callback) {
  if ( this.options.createDatabase ) {
    this.connection.query(
      'CREATE DATABASE IF NOT EXISTS ' + this.options.database + ' CHARACTER SET utf8 COLLATE utf8_unicode_ci',
      callback
    )    
  }
  else {
    process.nextTick(callback)
  }
}

Patcher.prototype.changeUser = function changeUser(callback) {
  this.connection.changeUser(
    {
      user     : this.options.user,
      password : this.options.password,
      database : this.options.database
    },
    callback
  )
}

Patcher.prototype.checkDbMetadataExists = function checkDbMetadataExists(callback) {
  var query = "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE table_schema = ? AND table_name = ?"
  this.connection.query(
    query,
    [ this.options.database, this.options.metaTable ],
    (function (err, result) {
      if (err) { return callback(err) }
      this.metaTableExists = result[0].count === 0 ? false : true
      callback()
    }).bind(this)
  )
}

Patcher.prototype.readDbPatchLevel = function readDbPatchLevel(callback) {
  if ( this.metaTableExists === false ) {
    // the table doesn't exist, so start at patch level 0
    this.currentPatchLevel = 0
    process.nextTick(callback)
    return
  }

  // find out what patch level the database is currently at
  var query = "SELECT value FROM " + this.options.metaTable +  " WHERE name = ?"
  this.connection.query(
    query,
    [ this.options.patchKey ],
    (function(err, result) {
      if (err) { return callback(err) }

      if ( result.length === 0 ) {
        // nothing in the table yet
        this.currentPatchLevel = 0
      }
      else {
        // convert the patch level from a string to a number
        this.currentPatchLevel = +result[0].value
      }

      callback()
    }).bind(this)
  )
}

Patcher.prototype.readPatchFiles = function readPatchFiles(callback) {

  this.patches = {}

  fs.readdir(this.options.dir, (function(err, files) {
    if (err) return callback(err)

    files = files.map((function(filename) {
      return path.join(this.options.dir, filename)
    }).bind(this))

    async.eachLimit(
      files,
      10,
      (function(filename, done) {
        var m = filename.match(/-(\d+)-(\d+)\.sql$/)
        if ( !m ) {
          return done(new Error('Unknown file format: ' + filename))
        }

        var from = parseInt(m[1], 10)
        var to = parseInt(m[2], 10)
        this.patches[from] = this.patches[from] || {}

        fs.readFile(filename, { encoding : 'utf8' }, (function(err, data) {
          if (err) return done(err)
          this.patches[from][to] = data
          done()
        }).bind(this))
      }).bind(this),
      function(err) {
        if (err) return callback(err)
        callback()
      }
    )
  }).bind(this))
}

Patcher.prototype.checkAllPatchesAvailable = function checkAllPatchesAvailable(callback) {

  this.patchesToApply = []

  // if we don't need any patches
  if ( this.options.patchLevel === this.currentPatchLevel ) {
    process.nextTick(callback)
    return
  }

  // First, loop through all the patches we need to apply to make sure they exist.
  var direction = this.currentPatchLevel < this.options.patchLevel ? 1 : -1
  var currentPatchLevel = this.currentPatchLevel
  var nextPatchLevel
  while ( currentPatchLevel !== this.options.patchLevel ) {
    nextPatchLevel = currentPatchLevel + direction

    // check that this patch exists
    if ( !this.patches[currentPatchLevel] || !this.patches[currentPatchLevel][nextPatchLevel] ) {
      process.nextTick(function() {
        callback(new Error('Patch from level ' + currentPatchLevel + ' to ' + nextPatchLevel + ' does not exist'))
      })
      return
    }

    // add this patch onto the patchesToApply
    this.patchesToApply.push({
      sql  : this.patches[currentPatchLevel][nextPatchLevel],
      from : currentPatchLevel,
      to   : nextPatchLevel,
    })
    currentPatchLevel += direction
  }

  callback()
}

Patcher.prototype.applyPatches = function applyPatches(callback) {
  async.eachSeries(
    this.patchesToApply,
    (function(patch, donePatch) {
      // emit : 'Updating DB for patch ' + patch.from + ' to ' + patch.to
      this.connection.query(patch.sql, (function(err, info) {
        if (err) return donePatch(err)

        // check that the database is now at the (intermediate) patch level
        var query = "SELECT value FROM " + this.options.metaTable +  " WHERE name = ?"
        this.connection.query(
          query,
          [ this.options.patchKey ],
          (function(err, result) {
            if (err) {
              // this is not an error if we are wanting to patch to level 0
              // and the problem is that the metaTable is not there
              if ( patch.to === 0 && err.errno === ERR_NO_SUCH_TABLE ) {
                return donePatch()
              }

              // otherwise, return this error since we don't know what it is
              return donePatch(err)
            }

            if ( result.length === 0 ) {
              // nothing in the table yet
              return donePatch(new Error('The patchKey does not exist in the metaTable'))
            }

            // convert the patch level from a string to a number
            result[0].value = +result[0].value

            // check if this value is incorrect
            if ( result[0].value !== patch.to ) {
              return donePatch(new Error('Patch level in metaTable (%s) is incorrect after this patch (%s)', result[0].value, patch.to))
            }

            this.currentPatchLevel = result[0].value
            donePatch()
          }).bind(this)
        )
      }).bind(this))
    }).bind(this),
    (function(err) {
      // Update our internal state if a patch created the db metadata table.
      if (this.metaTableExists) {
        callback(err)
      } else {
        this.checkDbMetadataExists(function(err2) {
          callback(err || err2)
        })
      }
    }).bind(this)
  )
}


// A much simpler, stateless function for just doing a patch.

Patcher.patch = function patch(options, callback) {
  callback = callback || noop

  try {
    var patcher = new Patcher(options);
  } catch (err) {
    return callback(err);
  }

  patcher.connect(function(err) {
    if (err) {
      return callback(err)
    }
    patcher.patch(function(err) {
      // Always close the connection, but preserve original error.
      patcher.end(function(err2) {
        return callback(err || err2)
      })
    })
  })

}


// main export
module.exports = Patcher
