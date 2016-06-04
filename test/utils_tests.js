// Tests for fathom/utils.js

const assert = require('chai').assert;
const jsdom = require('jsdom');

const {distance} = require('../utils');


// Assert that the distance between nodes a and b is greater in the `deep` DOM
// tree than in the `shallow` one.
function assertFarther(deep, shallow) {
    assert.isAbove(distance(deep.getElementById('a'),
                            deep.getElementById('b')),
                   distance(shallow.getElementById('a'),
                            shallow.getElementById('b')));
}


describe('Utils tests', function() {
    describe('distance()', function() {
        // If we keep these tests unbrittle enough, we can use them as a
        // fitness function to search for optimal values of cost coefficients.

        it('considers a node 0 distance from itself', function () {
            const doc = jsdom.jsdom(`
                <body>
                    <div id="a">
                    </div>
                </body>
            `);
            assert.equal(distance(doc.getElementById('a'),
                                  doc.getElementById('a')),
                         0);
        });

        it('considers deeper nodes farther than shallower', function () {
            const shallow = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            const deep = jsdom.jsdom(`
                <body>
                    <div>
                        <div>
                            <div id="a">
                            </div>
                        </div>
                    </div>
                    <div>
                        <div>
                            <div id="b">
                            </div>
                        </div>
                    </div>
                </body>
            `);
            assertFarther(deep, shallow);
        });

        it("doesn't crash over different-lengthed subtrees", function () {
            const doc = jsdom.jsdom(`
                <body>
                    <div>
                        <div>
                            <div id="a">
                            </div>
                        </div>
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            distance(doc.getElementById('a'),
                     doc.getElementById('b'));
        });

        it('rates descents through similar tags as shorter', function () {
            const dissimilar = jsdom.jsdom(`
                <body>
                    <center>
                        <div id="a">
                        </div>
                    </center>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            const similar = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            assertFarther(dissimilar, similar);
        });

        it('punishes the existence of stride nodes', function () {
            // "Stride" nodes are {(1) siblings or (2) siblings of ancestors}
            // that lie between the 2 nodes. These interposed nodes make it
            // less likely that the 2 nodes should be together in a cluster.
            const noStride = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            const edgeSiblings = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                        <div id="stride">
                        </div>
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);
            const stride = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                    </div>
                    <div id="stride">
                    </div>
                    <div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);

            const noSiblings = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                        <div id="b">
                        </div>
                        <div id="stride">
                        </div>
                    </div>
                </body>
            `);
            const interposedSiblings = jsdom.jsdom(`
                <body>
                    <div>
                        <div id="a">
                        </div>
                        <div id="stride">
                        </div>
                        <div id="b">
                        </div>
                    </div>
                </body>
            `);

            assertFarther(edgeSiblings, noStride);
            assertFarther(stride, noStride);
            assertFarther(interposedSiblings, noSiblings);
        });
    });
});
