const assert = require('chai').assert;
const jsdom = require('../node_modules/jsdom');

const fathom = require('../fathom'),
      dom = fathom.dom,
      rule = fathom.rule,
      ruleset = fathom.ruleset,
      flavor = fathom.flavor;


describe('Ranker', function() {
    it('scores a node with a simple DOM rule and inserts an empty scribble', function () {
        var doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);
        var rules = ruleset(
            rule(dom('a[class=good]'), node => [{scoreMultiplier: 2, flavor: 'anchor'}])
        );
        var kb = rules.score(doc);
        var node = kb.nodeForElement(doc.querySelectorAll('a[class=good]')[0]);
        assert.equal(node.score, 2);
        assert.equal(node.flavors.get('anchor'), undefined);
    });

    it('applies flavored rules when there is input for them', function () {
        var doc = jsdom.jsdom(`
            <p>Hi</p>
            <div>Hooooooo</div>
        `);
        var rules = ruleset(
            // 2 separate rules feed into the "paragraphish" flavor:
            rule(dom('div'), node => [{flavor: 'paragraphish'}]),
            rule(dom('p'), node => [{flavor: 'paragraphish', scoreMultiplier: 2}]),

            // Then each paragraphish thing receives a bonus based on its length:
            rule(flavor('paragraphish'), node => [{scoreMultiplier: node.element.textContent.length}])
        );
        var kb = rules.score(doc);
        var p = kb.nodeForElement(doc.querySelectorAll('p')[0]);
        var div = kb.nodeForElement(doc.querySelectorAll('div')[0]);
        assert.equal(p.score, 4);
        assert.equal(div.score, 8);
    });

    it("takes a decent shot at doing Readability's job");
    function piecesOfTheReadabilityTestCase() {
        const map = require('lodash/map');
        const sum = require('lodash/sum');

        var doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);
        var rules, kb;

        // Iterate, depth first, over a DOM node.
        // shouldTraverse - a function on a node saying whether we should include it
        //     and its children
        function *walk(node, shouldTraverse) {
            if (shouldTraverse(node)) {
                yield node;
                for (let child of node.childNodes) {
                    for (let w of walk(child, shouldTraverse)) {
                        yield w;
                    }
                }
            }
        }

        // Yield strings of text nodes within a normalized DOM node and its children,
        // without venturing into any contained block elements.
        function *inlineTexts(node) {
            for (let child of walk(node, node => !(isBlock(node) ||
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
        function paragraphish(node) {
            return {
                flavor: 'paragraphish',
                score: sum(map(inlineTexts(node),
                               str => collapseWhitespace.length))
            };
        }

        rules = ruleset(
            rule(dom('a[class=good]'), node => [{scoreMultiplier: 2, flavor: 'anchor'}])
        );
        kb = rules.score(doc);
    }
});
