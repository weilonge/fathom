// Tests for fathom/utils.js

const assert = require('chai').assert;
const jsdom = require('jsdom');

const {distance} = require('../utils');


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
            assert.isAbove(distance(deep.getElementById('a'),
                                    deep.getElementById('b')),
                           distance(shallow.getElementById('a'),
                                    shallow.getElementById('b')));
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
                         4);
        });
    });
});
