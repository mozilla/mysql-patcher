/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var patcher = require('../')

test('check that the changeUser is doing the right thing', function(t) {
  t.plan(2)

  var count = 0
  var ctx = {
    connection : {
      changeUser : function(obj, callback) {
        t.deepEqual(obj, ctx.options, 'The changeUser was passed user, password and database as expected')
        process.nextTick(callback)
      },
    },
    options : {
      user     : 'user',
      password : 'password',
      database : 'database',
    },
  }

  patcher.changeUser.call(ctx, function(err) {
    t.ok(!err, 'No error occurred')
    t.end()
  })
})
