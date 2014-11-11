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

// the main export from this package
function patch(options, callback) {
  callback = callback || noop

  // check the required options
  if ( !options.dir ) {
    return callback(new Error("Option 'dir' is required"))
  }

  if ( !('patchLevel' in options ) ) {
    return callback(new Error("Option 'patchLevel' is required"))
  }

  // set some defaults
  options.metaTable = options.metaTable || 'metadata'
  options.reversePatchAllowed = options.reversePatchAllowed || false
  options.patchKey = options.patchKey || 'patch'
  options.createDatabase = options.createDatabase || false

  // set this on the connection since we can have multiple statements in every patch
  options.multipleStatements = true

  // ToDo: fill in once other supporting functions are complete

  var context = {
    options : options,
  }
  async.series(
    [
      createConnection.bind(context),
      createDatabase.bind(context),
      changeUser.bind(context),
      checkDbMetadataExists.bind(context),
      readDbPatchLevel.bind(context),
      readPatchFiles.bind(context),
      checkAllPatchesAvailable.bind(context),
      applyPatches.bind(context),
    ],
    function(err) {
      if ( !context.connection ) {
        return callback(err)
      }

      context.connection.end(function(e) {
        // ignore this error if there is one, callback with the original error
        callback(err)
      })
    }
  )
}

function createConnection(callback) {
  // when creating the database, we need to connect without a database name
  var opts = clone(this.options)
  delete opts.database

  this.connection = this.options.mysql.createConnection(opts)
  this.connection.connect(function(err) {
    if (err) { return callback(err) }
    callback()
  })
}

function createDatabase(callback) {
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

function changeUser(callback) {
  this.connection.changeUser(
    {
      user     : this.options.user,
      password : this.options.password,
      database : this.options.database
    },
    callback
  )
}

function checkDbMetadataExists(callback) {
  var context = this
  var query = "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE table_schema = ? AND table_name = ?"
  this.connection.query(
    query,
    [ this.options.database, this.options.metaTable ],
    function (err, result) {
      if (err) { return callback(err) }
      context.metaTableExists = result[0].count === 0 ? false : true
      callback()
    }
  )
}

function readDbPatchLevel(callback) {
  var ctx = this

  if ( ctx.metaTableExists === false ) {
    // the table doesn't exist, so start at patch level 0
    ctx.currentPatchLevel = 0
    process.nextTick(callback)
    return
  }

  // find out what patch level the database is currently at
  var query = "SELECT value FROM " + ctx.options.metaTable +  " WHERE name = ?"
  ctx.connection.query(
    query,
    [ ctx.options.patchKey ],
    function(err, result) {
      if (err) { return callback(err) }

      if ( result.length === 0 ) {
        // nothing in the table yet
        ctx.currentPatchLevel = 0
      }
      else {
        // convert the patch level from a string to a number
        ctx.currentPatchLevel = +result[0].value
      }

      callback()
    }
  )
}

function readPatchFiles(callback) {
  var ctx = this

  ctx.patches = {}

  fs.readdir(ctx.options.dir, function(err, files) {
    if (err) return callback(err)

    files = files.map(function(filename) {
      return path.join(ctx.options.dir, filename)
    })

    async.eachLimit(
      files,
      10,
      function(filename, done) {
        var m = filename.match(/-(\d+)-(\d+)\.sql$/)
        if ( !m ) {
          return done(new Error('Unknown file format: ' + filename))
        }

        var from = parseInt(m[1], 10)
        var to = parseInt(m[2], 10)
        ctx.patches[from] = ctx.patches[from] || {}

        fs.readFile(filename, { encoding : 'utf8' }, function(err, data) {
          if (err) return done(err)
          ctx.patches[from][to] = data
          done()
        })
      },
      function(err) {
        if (err) return callback(err)
        callback()
      }
    )
  })
}

function checkAllPatchesAvailable(callback) {
  var ctx = this

  ctx.patchesToApply = []

  // if we don't need any patches
  if ( ctx.options.patchLevel === ctx.currentPatchLevel ) {
    process.nextTick(callback)
    return
  }

  // First, loop through all the patches we need to apply to make sure they exist.
  var direction = ctx.currentPatchLevel < ctx.options.patchLevel ? 1 : -1
  var currentPatchLevel = ctx.currentPatchLevel
  var nextPatchLevel
  while ( currentPatchLevel !== ctx.options.patchLevel ) {
    nextPatchLevel = currentPatchLevel + direction

    // check that this patch exists
    if ( !ctx.patches[currentPatchLevel] || !ctx.patches[currentPatchLevel][nextPatchLevel] ) {
      process.nextTick(function() {
        callback(new Error('Patch from level ' + currentPatchLevel + ' to ' + (currentPatchLevel+1) + ' does not exist'))
      })
      return
    }

    // add this patch onto the patchesToApply
    ctx.patchesToApply.push({
      sql  : ctx.patches[currentPatchLevel][nextPatchLevel],
      from : currentPatchLevel,
      to   : nextPatchLevel,
    })
    currentPatchLevel += direction
  }

  callback()
}

function applyPatches(callback) {
  var ctx = this

  async.eachSeries(
    ctx.patchesToApply,
    function(patch, donePatch) {
      // emit : 'Updating DB for patch ' + patch.from + ' to ' + patch.to
      ctx.connection.query(patch.sql, donePatch)
    },
    callback
  )
}

function closeConnection(callback) {
  this.connection.end(callback)
}

// main export
module.exports.patch = patch
// and these for testing purposes
module.exports.createDatabase = createDatabase
module.exports.changeUser = changeUser
module.exports.checkDbMetadataExists = checkDbMetadataExists
module.exports.readDbPatchLevel = readDbPatchLevel
module.exports.readPatchFiles = readPatchFiles
module.exports.checkAllPatchesAvailable = checkAllPatchesAvailable
module.exports.applyPatches = applyPatches
