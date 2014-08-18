/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var path = require('path')

var test = require('tape')
var patcher = require('../')

test('read patch set (ok)', function (t) {
  var ctx = {
    dir : path.join(__dirname, 'patches')
  }

  // call readPatchFiles() with the above context
  patcher.readPatchFiles.call(ctx, function(err) {
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
