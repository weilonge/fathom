const assert = require('chai').assert;
const jsdom = require('jsdom');

const {dom, rule, ruleset, flavor} = require('../fathom');


describe('Ranker', function() {
    it('scores a node with a simple DOM rule and inserts an empty scribble', function () {
        const doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);
        const rules = ruleset(
            rule(dom('a[class=good]'), node => [{scoreMultiplier: 2, flavor: 'anchor'}])
        );
        const kb = rules.score(doc);
        const node = kb.nodeForElement(doc.querySelectorAll('a[class=good]')[0]);
        assert.equal(node.score, 2);
        assert.equal(node.flavors.get('anchor'), undefined);
    });

    it('applies flavored rules when there is input for them', function () {
        const doc = jsdom.jsdom(`
            <p>Hi</p>
            <div>Hooooooo</div>
        `);
        const rules = ruleset(
            // 2 separate rules feed into the "paragraphish" flavor:
            rule(dom('div'), node => [{flavor: 'paragraphish'}]),
            rule(dom('p'), node => [{flavor: 'paragraphish', scoreMultiplier: 2}]),

            // Then each paragraphish thing receives a bonus based on its length:
            rule(flavor('paragraphish'), node => [{scoreMultiplier: node.element.textContent.length}])
        );
        const kb = rules.score(doc);
        const p = kb.nodeForElement(doc.querySelectorAll('p')[0]);
        const div = kb.nodeForElement(doc.querySelectorAll('div')[0]);
        assert.equal(p.score, 4);
        assert.equal(div.score, 8);
    });

    it("takes a decent shot at doing Readability's job");
    // HACK: We shouldn't ignore unused code.
    function piecesOfTheReadabilityTestCase() { // eslint-disable-line no-unused-vars
        const map = require('lodash/map');
        const sum = require('lodash/sum');

        const doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);

        // Iterate, depth first, over a DOM node.
        // shouldTraverse - a function on a node saying whether we should include it
        //     and its children
        function *walk(node, shouldTraverse) {
            if (shouldTraverse(node)) {
                yield node;
                for (const child of node.childNodes) {
                    for (const w of walk(child, shouldTraverse)) {
                        yield w;
                    }
                }
            }
        }

        // Yield strings of text nodes within a normalized DOM node and its children,
        // without venturing into any contained block elements.
        function *inlineTexts(node) {
            // HACK: Not sure why `isBlock()` is undefined below.
            for (const child of walk(node, node => !(isBlock(node) || // eslint-disable-line no-undef
                                                   node.tagName === 'script' &&
                                                   node.tagName === 'style'))) {
                if (child.nodeType === child.TEXT_NODE) {
                    // .wholeText is what needs the DOM tree to be normalized.
                    // Otherwise, it'll return the contents of adjacent text nodes,
                    // too, and we'll get those contents a second time when we traverse
                    // to them.
                    yield child.wholeText;
                }
            }
        }

        function collapseWhitespace(str) {
            return str.replace(/\s{2,}/g, ' ');
        }

        // Return a fact that scores a DOM node based on how much it resembles a
        // maximally tight block element full of text.
        // HACK: We shouldn't ignore unused code.
        function paragraphish(node) { // eslint-disable-line no-unused-vars
            return {
                flavor: 'paragraphish',
                score: sum(map(inlineTexts(node),
                               str => collapseWhitespace.length))
            };
        }

        const rules = ruleset(
            rule(dom('a[class=good]'), node => [{scoreMultiplier: 2, flavor: 'anchor'}])
        );
        // HACK: We shouldn't ignore unused code.
        const kb = rules.score(doc); // eslint-disable-line no-unused-vars
    }
});
