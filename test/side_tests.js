// Tests for fathom/side.js

const assert = require('chai').assert;

const {type} = require('../side');


describe('Side tests', function () {
    it('makes a LHS out of a type()', function () {
        const side = type('smoo');
        assert(side.asLhs);  // It appears to be a Side.
        const lhs = side.asLhs();
        assert.notStrictEqual(lhs.max);  // It appears to be a TypeLhs.
    });
});
