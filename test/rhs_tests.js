const {assert} = require('chai');

const {func, type} = require('../index');


describe.only('RHS', function () {
    it('Different calls combine piecewise, with rightmost repeated subfacts shadowing.', function () {
        const rhs = type('foo').score(5).func(node => ({score: 6})).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {type: 'foo', score: 6});
    });

    it('Same-named calls shadow, with rightmost winning.', function () {
        const rhs = func(node => ({score: 1})).func(node => ({note: 'foo'})).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {note: 'foo'});
    });
});
