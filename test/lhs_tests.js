const assert = require('chai').assert;

const {dom, rule, type} = require('../index');


describe('LHS tests', function () {
    it('makes a dom() LHS that rule() tolerates', function () {
        const lhs = dom('smoo');
        const rhs = type('bar');
        const theRule = rule(lhs, rhs);
    });
});
