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

        it("doesn't trip over different-lengthed subtrees", function () {
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
            assert.equal(distance(doc.getElementById('a'),
                                  doc.getElementById('b')),
                         4);  // brittle
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
    });
});
