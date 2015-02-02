/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var Patcher = require('../')
var mockMySQL = require('./mock-mysql')

test('read patch set (ok)', function (t) {

  var p = new Patcher({
    dir : path.join(__dirname, 'patches'),
    patchLevel : 0,
    mysql : mockMySQL()
  })

  p.readPatchFiles(function(err) {
    t.ok(!err, 'No error occurred')

    var patches = p.patches

    // check there are 3 patch levels
    var levels = Object.keys(patches).length
    t.equal(levels, 3, 'There are three patch levels (0, 1, 2)')

    // check the correct number of patches for each level
    t.equal(Object.keys(patches[0]).length, 1, 'One patch for level 0')
    t.equal(Object.keys(patches[1]).length, 2, 'Two patches for level 1')
    t.equal(Object.keys(patches[2]).length, 1, 'One patch for level 2')

    // check the contents of the patch files
    t.equal(patches[0][1], '-- 0->1\n', 'Patch 0 to 1 is ok')
    t.equal(patches[1][2], '-- 1->2\n', 'Patch 1 to 2 is ok')
    t.equal(patches[2][1], '-- 2->1\n', 'Patch 2 to 1 is ok')
    t.equal(patches[1][0], '-- 1->0\n', 'Patch 1 to 0 is ok')

    t.end()
  })
})

test('check all patches are available (forwards)', function(t) {

  var p = new Patcher({
    patchLevel : 2,
    dir : "nonexistent",
    mysql : mockMySQL()
  })
  p.currentPatchLevel = 0
  p.patches = {
    '0' : {
      '1' : '-- 0->1\n',
    },
    '1' : {
      '2' : '-- 1->2\n',
    }
  }

  p.checkAllPatchesAvailable(function(err) {
    t.ok(!err, 'No error occurred')

    var patches = [
      { sql : '-- 0->1\n', from : 0, to : 1, },
      { sql : '-- 1->2\n', from : 1, to : 2, },
    ]
    t.deepEqual(p.patchesToApply, patches, 'The patches to be applied')

    t.end()
  })

})

test('check all patches are available (backwards)', function(t) {
  var p = new Patcher({
    patchLevel : 0,
    dir : "nonexistent",
    mysql : mockMySQL()
  })
  p.currentPatchLevel = 2
  p.patches = {
    '2' : {
      '1' : '-- 2->1\n',
    },
    '1' : {
      '0' : '-- 1->0\n',
    }
  }

  p.checkAllPatchesAvailable(function(err) {
    t.ok(!err, 'No error occurred')

    var patches = [
      { sql : '-- 2->1\n', from : 2, to : 1, },
      { sql : '-- 1->0\n', from : 1, to : 0, },
    ]
    t.deepEqual(p.patchesToApply, patches, 'The patches to be applied')

    t.end()
  })

})

test('check all patches are available (fails, no patch #2)', function(t) {
  var p = new Patcher({
    patchLevel : 2,
    dir : "nonexistent",
    mysql : mockMySQL()
  })
  p.currentPatchLevel = 0
  p.patches = {
    '0' : {
      '1' : '-- 0->1\n',
    }
  }

  p.checkAllPatchesAvailable(function(err) {
    t.ok(err, 'An error occurred since patch 2 is missing')

    t.equal(err.message, 'Patch from level 1 to 2 does not exist', 'The error message is correct')

    t.end()
  })
})

test('check all patches are available (fails, no patch #1)', function(t) {
  var p = new Patcher({
    patchLevel : 2,
    dir : "nonexistent",
    mysql : mockMySQL()
  })
  p.currentPatchLevel = 0
  p.patches = {
    '1' : {
      '2' : '-- 1->2\n',
    }
  }

  p.checkAllPatchesAvailable(function(err) {
    t.ok(err, 'An error occurred since patch 1 is missing')

    t.equal(err.message, 'Patch from level 0 to 1 does not exist', 'The error message is correct')

    t.end()
  })
})

test('checking that these patch files are executed', function(t) {
  var count = 0
  var p = new Patcher({
    dir : path.join(__dirname, 'end-to-end'),
    metaTable : 'metadata',
    patchKey : 'schema-patch-level',
    patchLevel : 3,
    mysql : mockMySQL({
      query : function(sql, args, callback) {
        if ( typeof callback === 'undefined' ) {
          callback = args
          args = undefined
        }
        // Mock out db-metadata-related queries.
        if ( sql.match(/SELECT value FROM metadata WHERE name/) ) {
          return callback(null, [{value: ""+count}])
        }
        if ( sql.match(/SELECT .+ AS count FROM information_schema/) ) {
          return callback(null, [{count: 1}])
        }
        t.equal(sql, p.patchesToApply[count].sql, 'SQL is correct')
        count += 1
        callback(null, [])
      }
    })
  })
  p.currentPatchLevel = 0

  p.createConnection(function(err) {
    t.ok(!err, 'No error occurred while creating connection')
    p.readPatchFiles(function(err) {
      t.ok(!err, 'No error occurred while reading patch files')
      p.checkAllPatchesAvailable(function(err) {
        t.ok(!err, 'No error occurred while checking patches are available')
        p.applyPatches(function(err) {
          t.ok(!err, 'No error occurred while applying patches')
          t.equal(count, 3, 'all patches were executed')
          t.equal(p.currentPatchLevel, 3, 'the patch level was updated')
          t.end()
        })
      })
    })
  })

})

test('checking that an error comes back if a patch is missing', function(t) {
  t.plan(4)

  var p = new Patcher({
    metaTable : 'metadata',
    patchKey  : 'level',
    patchLevel : 0,
    dir : "nonexistent",
    mysql : mockMySQL({
      query : function(sql, args, callback) {
        if ( typeof callback === 'undefined' ) {
          callback = args
          args = undefined
        }
        // Mock out db-metadata-related queries.
        if ( sql.match(/SELECT .+ AS count FROM information_schema/) ) {
          return callback(null, [{count: 0}])
        }
        t.equal(sql, '-- 0->1', 'The sql is what is expected')
        callback(new Error('Something went wrong'))
      }
    })
  })
  p.patchesToApply = [
      { sql : '-- 0->1' },
  ]

  p.createConnection(function(err) {
    t.ok(!err, 'No error occurred')
    p.applyPatches(function(err) {
      t.ok(err, 'An error occurred')
      t.equal(err.message, 'Something went wrong', 'The message is correct')
      t.end()
    })
  })
})
