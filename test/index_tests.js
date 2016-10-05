// Tests for fathom/index.js

const assert = require('chai').assert;
const jsdom = require('jsdom');

const {dom, func, rule, ruleset, type} = require('../index');


describe('Ranker tests', function () {
    it.skip('scores a node with a simple DOM rule and inserts an empty scribble', function () {
        const doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);
        const rules = ruleset(
            rule(dom('a[class=good]'), node => [{score: 2, flavor: 'anchor'}])
        );
        const kb = rules.score(doc);
        const node = kb.nodeForElement(doc.querySelectorAll('a[class=good]')[0]);
        assert.equal(node.score, 2);
        assert.equal(node.flavors.get('anchor'), undefined);
    });

    it.skip('applies typed rules when there is input for them', function () {
        const doc = jsdom.jsdom(`
            <p>Hi</p>
            <div>Hooooooo</div>
        `);
        const rules = ruleset(
            // 2 separate rules feed into the "paragraphish" flavor:
            rule(dom('div'), type('paragraphish')),
            rule(dom('p'), type('paragraphish').score(2)),

            // Then each paragraphish thing receives a bonus based on its length:
            rule(type('paragraphish'), func(node => ({score: node.element.textContent.length})))
        );
        const boundRules = rules.against(doc);
        const p = boundRules.get(doc.querySelectorAll('p')[0]);
        const div = boundRules.get(doc.querySelectorAll('div')[0]);
        assert.equal(p.score, 4);
        assert.equal(div.score, 8);
    });
});
