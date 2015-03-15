/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var xtend = require('xtend')
var mysql = require('mysql')
var test = require('tape')

var patcher = require('../')

var options = {
  createDatabase : true,
  // user       : '', // set in each test
  database   : 'patcher',
  // password   : '', // set in each test
  patchKey   : 'schema-patch-level',
  mysql      : mysql,
}

test('run test with invalid user', function(t) {
  // set expected patch and metaTable
  var opts = xtend(
    options,
    {
      user       : 'unknown-user',
      password   : 'password',
      dir        : path.join(__dirname, 'non-existant-dir'),
      patchLevel : 1,
      metaTable  : 'failed_insert',
    }
  )

  t.plan(3)

  patcher.patch(opts, function(err, res) {
    t.ok(err, 'There was an error when patching the database')
    t.ok(!res, 'No result was returned')
    t.equal('' + err, "Error: ER_ACCESS_DENIED_ERROR: Access denied for user 'unknown-user'@'localhost' (using password: YES)")
    t.end()
  })
})

test('run test with incorrect password', function(t) {
  // set expected patch and metaTable
  var opts = xtend(
    options,
    {
      user       : 'root',
      password   : 'incorrect-password',
      dir        : path.join(__dirname, 'non-existant-dir'),
      patchLevel : 1,
      metaTable  : 'failed_insert',
    }
  )

  t.plan(3)

  patcher.patch(opts, function(err, res) {
    t.ok(err, 'There was an error when patching the database')
    t.ok(!res, 'No result was returned')
    t.equal('' + err, "Error: ER_ACCESS_DENIED_ERROR: Access denied for user 'root'@'localhost' (using password: YES)")
    t.end()
  })
})
