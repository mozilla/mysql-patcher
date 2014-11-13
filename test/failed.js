/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var xtend = require('xtend')
var mysql = require('mysql')
var test = require('tape')

var patcher = require('../')

var options = {
  createDatabase : true,
  user       : 'root',
  database   : 'patcher',
  password   : '',
  patchKey   : 'schema-patch-level',
  mysql      : mysql,

  // dir        : ?, // \
  // metaTable  : ?, //  > to be set in each test
  // patchLevel : ?, // /
}

test('run an end to end test, error updating metaTable in patch 1', function(t) {
  // set expected patch and metaTable
  var opts = xtend(
    options,
    {
      dir        : path.join(__dirname, 'failed-insert'),
      patchLevel : 1,
      metaTable  : 'failed_insert',
    }
  )

  // create a connection for us to use directly
  var connection = mysql.createConnection(opts)

  t.plan(3)

  patcher.patch(opts, function(err, res) {
    t.ok(err, 'There was an error when patching the database')
    t.ok(!res, 'No result was returned')
    t.equal('' + err, 'Error: The patchKey does not exist in the metaTable', 'Error message is correct')
    connection.end()
    t.end()
  })
})

test('run an end to end test, metaTable not created', function(t) {
  // set expected patch and metaTable
  var opts = xtend(
    options,
    {
      dir        : path.join(__dirname, 'failed-create-metatable'),
      patchLevel : 1,
      metaTable  : 'failed_create_metatable',
    }
  )

  // create a connection for us to use directly
  var connection = mysql.createConnection(opts)

  t.plan(4)

  patcher.patch(opts, function(err, res) {
    t.ok(err, 'There was an error when patching the database')
    t.ok(!res, 'No result was returned')
    // t.equal('' + err, 'Error: ER_NO_SUCH_TABLE: Table \'patcher.failed_create_metatable\' doesn\'t exist', 'Error message is correct')
    t.equal(err.errno, 1146, 'Error number is correct')
    t.equal(err.code, 'ER_NO_SUCH_TABLE', 'Error code is correct')
    connection.end()
    t.end()
  })
})
