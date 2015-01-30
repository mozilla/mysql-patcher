/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var xtend = require('xtend')

var defaultConnectionMethods = {
  connect: function mockConnect(callback) {
    return callback()
  },
  query: function mockQuery() {
    throw 'query() should not have been called'
  },
  changeUser: function mockChangeUser() {
    throw 'changeUser() should not have been called'
  }
}

module.exports = function mockMySQL(mockMethods) {
  return {
    createConnection: function(callback) {
      return xtend(defaultConnectionMethods, mockMethods || {});
    }
  }
}

