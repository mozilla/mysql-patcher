/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var patcher = require('../')

test('read patch set (ok)', function (t) {
  var ctx = {
    options : {
      dir : path.join(__dirname, 'patches'),
    },
  }

  // call readPatchFiles() with the above context
  patcher.readPatchFiles.call(ctx, function(err) {
    t.ok(!err, 'No error occurred')

    var patches = ctx.patches

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
  var ctx = {
    options : {
      patchLevel : 2,
    },
    currentPatchLevel : 0,
    patches : {
      '0' : {
        '1' : '-- 0->1\n',
      },
      '1' : {
        '2' : '-- 1->2\n',
      },
    },
  }

  patcher.checkAllPatchesAvailable.call(ctx, function(err) {
    t.ok(!err, 'No error occurred')

    var patches = [
      { sql : '-- 0->1\n', from : 0, to : 1, },
      { sql : '-- 1->2\n', from : 1, to : 2, },
    ]
    t.deepEqual(ctx.patchesToApply, patches, 'The patches to be applied')

    t.end()
  })

})

test('check all patches are available (backwards)', function(t) {
  var ctx = {
    options : {
      patchLevel : 0,
    },
    currentPatchLevel : 2,
    patches : {
      '2' : {
        '1' : '-- 2->1\n',
      },
      '1' : {
        '0' : '-- 1->0\n',
      },
    },
  }

  patcher.checkAllPatchesAvailable.call(ctx, function(err) {
    t.ok(!err, 'No error occurred')

    var patches = [
      { sql : '-- 2->1\n', from : 2, to : 1, },
      { sql : '-- 1->0\n', from : 1, to : 0, },
    ]
    t.deepEqual(ctx.patchesToApply, patches, 'The patches to be applied')

    t.end()
  })

})

test('check all patches are available (fails, no patch #2)', function(t) {
  var ctx = {
    options : {
      patchLevel : 2,
    },
    currentPatchLevel : 0,
    patches : {
      '0' : {
        '1' : '-- 0->1\n',
      },
    },
  }

  patcher.checkAllPatchesAvailable.call(ctx, function(err) {
    t.ok(err, 'An error occurred since patch 2 is missing')

    t.equal(err.message, 'Patch from level 1 to 2 does not exist', 'The error message is correct')

    t.end()
  })
})

test('check all patches are available (fails, no patch #1)', function(t) {
  var ctx = {
    options : {
      patchLevel : 2,
    },
    currentPatchLevel : 0,
    patches : {
      '1' : {
        '2' : '-- 1->2\n',
      },
    },
  }

  patcher.checkAllPatchesAvailable.call(ctx, function(err) {
    t.ok(err, 'An error occurred since patch 1 is missing')

    t.equal(err.message, 'Patch from level 0 to 1 does not exist', 'The error message is correct')

    t.end()
  })
})

test('checking that these patch files are executed', function(t) {
  var count = 0
  var ctx = {
    connection : {
      query : function(sql, callback) {
        t.equal(sql, ctx.patchesToApply[count].sql, 'SQL is correct')
        count += 1
        callback()
      },
    },
    patchesToApply : [
      { sql : '-- 0->1' },
      { sql : '-- 1->2' },
      { sql : '-- 2->3' },
    ],
  }

  patcher.applyPatches.call(ctx, function(err) {
    t.ok(!err, 'No error occurred')
    t.end()
  })
})

test('checking that an error comes back if a patch is missing', function(t) {
  t.plan(3)

  var count = 0
  var ctx = {
    connection : {
      query : function(sql, callback) {
        t.equal(sql, '-- 0->1', 'The sql is what is expected')
        callback(new Error('Something went wrong'))
      },
    },
    patchesToApply : [
      { sql : '-- 0->1' },
    ],
  }

  patcher.applyPatches.call(ctx, function(err) {
    t.ok(err, 'An error occurred')
    t.equal(err.message, 'Something went wrong', 'The message is correct')
    t.end()
  })
})
