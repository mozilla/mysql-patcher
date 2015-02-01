/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var Patcher = require('../')
var mockMySQL = require('./mock-mysql')

test('check that the changeUser is doing the right thing', function(t) {
  t.plan(5)

  var options = {
    user : 'user',
    password : 'password',
    database : 'database',
    dir : 'nonexistent',
    patchLevel: 0,
    mysql : mockMySQL({
      changeUser : function(obj, callback) {
        t.equal(obj.user, options.user, 'changeUser was passed user correctly')
        t.equal(obj.password, options.password, 'changeUser was passed password correctly')
        t.equal(obj.database, options.database, 'changeUser was passed database correctly')
        process.nextTick(callback)
      }
    })
  }
  var p = new Patcher(options);
  p.createConnection(function(err) {
    t.ok(!err, 'No error occurred')
    p.changeUser(function(err) {
      t.ok(!err, 'No error occurred')
      t.end()
    })
  })
})
