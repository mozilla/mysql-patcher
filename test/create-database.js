/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var Patcher = require('../')
var mockMySQL = require('./mock-mysql')

test('check that createDatabase is being called when asked for', function(t) {
  t.plan(3)

  var p = new Patcher({
    database : 'database',
    createDatabase : true,
    dir: 'nonexistent',
    patchLevel: 0,
    mysql : mockMySQL({
      query : function(sql, callback) {
        t.equal(sql, 'CREATE DATABASE IF NOT EXISTS database CHARACTER SET utf8 COLLATE utf8_unicode_ci')
        callback()
      }
    })
  })

  p.createConnection(function(err) {
    t.ok(!err, 'No error occurred')
    p.createDatabase(function(err) {
      t.ok(!err, 'No error occurred')
      t.end()
    })
  })
})

test('check that createDatabase is not being called when false', function(t) {
  t.plan(2)

  var p = new Patcher({
    database : 'database',
    createDatabase : false,
    dir: 'nonexistent',
    patchLevel: 0,
    mysql : mockMySQL({
      query : function(sql, callback) {
        t.fail('.query() should not have been called with the create database command')
        callback()
      }
    })
  })

  p.createConnection(function(err) {
    t.ok(!err, 'No error occurred')
    p.createDatabase(function(err) {
      t.ok(!err, 'No error occurred')
      t.end()
    })
  })
})
