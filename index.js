/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// core
var fs = require('fs')
var path = require('path')

// npm
var async = require('async')

function noop() { }

function readPatchFiles(dir, callback) {
  var patches = {}

  fs.readdir(dir, function(err, files) {
    if (err) return callback(err)

    files = files.map(function(filename) {
      return path.join(dir, filename)
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
        patches[from] = patches[from] || {}

        fs.readFile(filename, { encoding : 'utf8' }, function(err, data) {
          if (err) return done(err)
          patches[from][to] = data
          done()
        })
      },
      function(err) {
        if (err) return callback(err)
        callback(null, patches)
      }
    )
  })
}

// Options:
//

function patch(options, callback) {
  // callback is required
  if ( typeof callback !== 'function' ) {
    return callback(new Error('A callback must be provided'))
  }

  // check the required options
  if ( !options.dir ) {
    return callback(new Error("Option 'dir' must be provided"))
  }

  // ToDo: fill in once other supporting functions are complete

}

module.exports.readPatchFiles = readPatchFiles
module.exports.patch          = patch
