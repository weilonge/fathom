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
});
