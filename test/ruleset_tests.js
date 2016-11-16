const {assert} = require('chai');
const {jsdom} = require('jsdom');

const {dom, func, out, rule, ruleset, score, type, typeIn} = require('../index');


describe('Ruleset', function () {
    describe('get()s', function () {
        it('by arbitrary passed-in LHSs (and scores dom() nodes at 1)', function () {
            const doc = jsdom(`
                <div>Hooooooo</div>
            `);
            const rules = ruleset(
                rule(dom('div'), type('paragraphish'))
            );
            const facts = rules.against(doc);
            const div = facts.get(type('paragraphish'))[0];
            assert.equal(div.getScore('paragraphish'), 1);
        });

        it('results by out-rule key', function () {
            const doc = jsdom(`
                <div>Hooooooo</div>
            `);
            const rules = ruleset(
                rule(dom('div'), type('paragraphish')),
                rule(type('paragraphish'), out('p'))
            );
            assert.equal(rules.against(doc).get('p').length, 1);
        });

        it('the fnode corresponding to a passed-in node', function () {
            const doc = jsdom(`
                <div>Hooooooo</div>
            `);
            const rules = ruleset(
                rule(dom('div'), type('paragraphish')),  // when we add .score(1), the test passes.
                rule(type('paragraphish'), func(node => ({score: node.element.textContent.length})))
            );
            const facts = rules.against(doc);
            const div = facts.get(doc.querySelectorAll('div')[0]);
            assert.equal(div.getScore('paragraphish'), 8);
        });
    });

    it('assigns scores and notes to nodes', function () {
        // Test the score() and note() calls themselves as well as the ruleset
        // that obeys them.
        const doc = jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);
        const rules = ruleset(
            rule(dom('a[class=good]'), score(2).type('anchor').note(fnode => 'lovely'))
        );
        const anchors = rules.against(doc).get(type('anchor'));
        // Make sure dom() selector actually discriminates:
        assert.equal(anchors.length, 1);
        const anchor = anchors[0];
        assert.equal(anchor.getScore('anchor'), 2);
        assert.equal(anchor.getNote('anchor'), 'lovely');
    });

    describe('avoids cycles', function () {
        it('that should be statically detectable, throwing an error', function () {
            const doc = jsdom('<p></p>');
            const rules = ruleset(
                rule(dom('p'), type('a')),
                rule(type('a'), type('b')),
                rule(type('b'), type('a'))
            );
            const facts = rules.against(doc);
            assert.throws(() => facts.get(type('a')),
                          'There was a cyclic dependency in the ruleset.');
        });
        // Pass a growing Set of rules around, and don't re-run any. Run order shouldn't matter, because we forbid notes from overwriting, score multiplication is commutative, and type assignment is idempotent and immutable.

        it("that would happen if we didn't track what we'd run already", function () {
            const doc = jsdom('<p></p>');
            const rules = ruleset(
                rule(dom('p'), type('a')),
                rule(dom('p'), type('b')),
                rule(type('a'), func(fnode => ({type: 'c'}))),  // 1  // runs 2
                rule(type('b'), func(fnode => ({type: 'd'}))),  // 2  // runs 1
                rule(type('c'), out('c'))  // 3  // runs 1, 2 because it can't tell what types they return
            );
            const facts = rules.against(doc);
            const p = facts.get('c')[0];
            // Not only do we not end up in an infinite loop, but we run all
            // rules that could lead to the requested type c as well:
            assert(p.hasType('a'));
            assert(p.hasType('b'));
            assert(p.hasType('c'));
            assert(p.hasType('d'));
        });
    });

    describe('conserves score', function () {
        it('only when conserveScore() is used, using per-type scores otherwise', function () {
            // Also test that rules fire lazily.
            const doc = jsdom(`
                <p></p>
            `);
            const rules = ruleset(
                rule(dom('p'), type('para').score(2)),
                rule(type('para'), type('smoo').score(5)),
                rule(type('para'), type('smee').score(5).conserveScore())
            );
            const facts = rules.against(doc);

            const para = facts.get(type('para'))[0];
            // Show other-typed scores don't backpropagate to the upstream type:
            assert.equal(para.getScore('para'), 2);
            // Other rules have had no reason to run yet, so their types' scores
            // remain the default:
            assert.equal(para.getScore('smoo'), 1);

            const smoo = facts.get(type('smoo'))[0];
            // Fresh score:
            assert.equal(smoo.getScore('smoo'), 5);

            const smee = facts.get(type('smee'))[0];
            // Conserved score:
            assert.equal(smee.getScore('smee'), 10);
        });

        it('when rules emitting the same element and type conflict on conservation', function () {
            const doc = jsdom(`
                <p></p>
            `);
            const rules = ruleset(
                rule(dom('p'), type('para').score(2)),
                rule(type('para'), type('smoo').score(5)),
                rule(type('para'), type('smoo').score(7).conserveScore())
            );
            const facts = rules.against(doc);
            const para = facts.get(type('smoo'))[0];
            assert.equal(para.getScore('smoo'), 70);
        });

        it('but never factors in a score more than once', function () {
            const doc = jsdom(`
                <p></p>
            `);
            const rules = ruleset(
                rule(dom('p'), type('para').score(2)),
                rule(type('para'), type('smoo').score(5).conserveScore()),
                rule(type('para'), type('smoo').score(7).conserveScore())
            );
            const facts = rules.against(doc);
            const para = facts.get(type('smoo'))[0];
            assert.equal(para.getScore('smoo'), 70);
        });
    });

    describe('plans rule execution in dependency order', function () {
        it('demands rules are of determinate type', function () {
            assert.throws(() => ruleset(rule(dom('p'), func('dummy'))),
                          'A rule did not declare the types it can emit using type() or typeIn().');
        });

        it('remembers what types rules add and emit', function () {
            const rule1 = rule(dom('p'), func('dummy').typeIn('q', 'r'));
            const rule2 = rule(type('r'), type('s'));
            const facts = ruleset(rule1, rule2).against(jsdom(''));
            assert.deepEqual(facts.inwardRulesThatCouldEmit('q'), [rule1]);
            assert.deepEqual(facts.inwardRulesThatCouldAdd('s'), [rule2]);
        });
    });
});

describe('Rule', function () {
    it('knows what it can add and emit', function () {
        const a = rule(dom('p'), type('para'));
        assert.sameMembers(Array.from(a.typesItCouldEmit()), ['para']);
        assert.sameMembers(Array.from(a.typesItCouldAdd()), ['para']);

        const b = rule(type('r'), typeIn('q').func('dummy').typeIn('r', 's'));
        assert.sameMembers(Array.from(b.typesItCouldEmit()), ['r', 's']);
        assert.sameMembers(Array.from(b.typesItCouldAdd()), ['s']);

        const c = rule(type('a'), score(2));
        assert.sameMembers(Array.from(c.typesItCouldEmit()), ['a']);
    });

    it('identifies prerequisite rules', function () {
        const domRule = rule(dom('p'), type('a'));
        const maxRule = rule(type('a').max(), type('b'));
        const maintainRule = rule(type('b'), score(2));
        const addRule = rule(type('b'), type('c'));
        const rules = ruleset(domRule, maxRule, maintainRule, addRule);
        const facts = rules.against(jsdom(''));
        assert.deepEqual(domRule.prerequisites(facts), []);
        assert.deepEqual(maxRule.prerequisites(facts), [domRule]);
        assert.deepEqual(maintainRule.prerequisites(facts), [maxRule]);
        assert.sameMembers(addRule.prerequisites(facts), [maxRule, maintainRule]);

        const prereqs = facts._prerequisitesTo(addRule);

        const util = require('util');
        console.log(util.inspect(prereqs, false, null));

        // TODO: Replace with deepEqual when chai >= 4.0 supports Maps and Sets.
        assert.equal(prereqs.size, 3);
        assert.deepEqual(prereqs.get(maintainRule), [addRule]);
        assert.deepEqual(prereqs.get(domRule), [maxRule]);
        assert.deepEqual(prereqs.get(maxRule), [addRule, maintainRule]);
    });
});


// colliding notes
// Maybe there should be a default .score and .note on fnodes that are selected by a type() selector, so we don't have to say getScore('someType'), repeating ourselves.

// XXX: Test to make sure a rule like type(a) → func(...).score(2).typeIn(b, c) doesn't multiply a node's score by 2 twice if we exec type(b) and then type(c), which might be tempted to exec the initial rule twice. Probably we should cache the incomplete-type results of every rule so we never run them more than once.
// Similarly, decide if * → func(...).score(2) should multiply the score more than once if it just returns the same node over and over. Yes, because it would if you divided it into 2 rules. And if you don't like it, don't return the same element multiple times from func!