const {assert} = require('chai');

const {func, type} = require('../index');


describe('RHS', function () {
    it('combines different calls piecewise, with rightmost repeated subfacts shadowing', function () {
        const rhs = type('foo').score(5).func(node => ({score: 6})).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {type: 'foo', score: 6});
    });

    it('has same-named calls shadow, with rightmost winning', function () {
        const rhs = func(node => ({score: 1})).func(node => ({note: 'foo'})).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {note: 'foo'});
    });

    it('runs callbacks only once', function () {
        let count = 0;
        function addOne() {
            count++;
            return {};
        }
        const rhs = func(addOne).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {});
        assert.equal(count, 1);
    });

    it('ignores unexpected subfacts returned from func() callbacks', function () {
        const rhs = func(node => ({conserveScore: true, score: 3})).asRhs();
        assert.deepEqual(rhs.fact('dummy'), {score: 3});
    });
});
