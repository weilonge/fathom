const {assert} = require('chai');

const {toposort} = require('../utils');


describe('Utils', function () {
    describe('toposort', function () {
        it.only('sorts', function () {
            // Return answers that express the graph...
            // 4 <- 5 <- 6   <-  7
            //           |       |
            //           v       v
            //          5.1  <- 6.1
            // ...where -> means "needs".
            function nodesThatNeed(node) {
                return node === 5.1 ? [6, 6.1] : (node === 7 ? [] : [Math.floor(node) + 1]);
            }
            assert.deepEqual(toposort([4, 5, 5.1, 6, 6.1, 7], nodesThatNeed),
                             [7, 6, 5, 4, 6.1, 5.1]);
        });
        it('detects cycles', function () {
            // Express a graph of 3 nodes pointing in a circle.
            function nodesThatNeed(node) {
                return [(node + 1) % 3];
            }
            assert.throws(() => toposort([0, 1, 2], nodesThatNeed),
                          'The graph has a cycle.');
        });
    });
});
